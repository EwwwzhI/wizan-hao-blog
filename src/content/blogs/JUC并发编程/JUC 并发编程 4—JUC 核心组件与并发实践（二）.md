---
title: JUC 并发编程 4—JUC 核心组件与并发实践（二）
description: JUC Concurrent programming——JUC Core Components and Concurrency Practices
pubDate: 2026-05-08
lastModDate: ''
ogImage: false
toc: true
search: true
---

[【跳转到上一篇：JUC并发编程 3—JUC 核心组件与并发实践（一）】](/blogs/juc并发编程/juc-并发编程-3juc-核心组件与并发实践一/)

## 十二、同步工具类（基于 AQS 或 CAS 的实用组件）（未整理）

- CountDownLatch（倒计时门闩）
- CyclicBarrier（循环屏障）
- Semaphore（信号量，控制并发数）
- Phaser（动态阶段同步）

### 计数器锁 CountDownLatch

多任务同步神器。它允许一个或多个线程，等待其他线程完成工作，比如现在我们有这样的一个需求：

* 有20个计算任务，我们需要先将这些任务的结果全部计算出来，每个任务的执行时间未知
* 当所有任务结束之后，立即整合统计最终结果

要实现这个需求，那么有一个很麻烦的地方，我们不知道任务到底什么时候执行完毕，那么可否将最终统计延迟一定时间进行呢？但是最终统计无论延迟多久进行，要么不能保证所有任务都完成，要么可能所有任务都完成了而这里还在等。

所以说，我们需要一个能够实现子任务同步的工具。

```java
public static void main(String[] args) throws InterruptedException {
    CountDownLatch latch = new CountDownLatch(20);  //创建一个初始值为10的计数器锁
    for (int i = 0; i < 20; i++) {
        int finalI = i;
        new Thread(() -> {
            try {
                Thread.sleep((long) (2000 * new Random().nextDouble()));
                System.out.println("子任务"+ finalI +"执行完成！");
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            latch.countDown();   //每执行一次计数器都会-1
        }).start();
    }

    //开始等待所有的线程完成，当计数器为0时，恢复运行
    latch.await();   //这个操作可以同时被多个线程执行，一起等待，这里只演示了一个
    System.out.println("所有子任务都完成！任务完成！！！");
  
  	//注意这个计数器只能使用一次，用完只能重新创一个，没有重置的说法
}
```

我们在调用`await()`方法之后，实际上就是一个等待计数器衰减为0的过程，而进行自减操作则由各个子线程来完成，当子线程完成工作后，那么就将计数器-1，所有的子线程完成之后，计数器为0，结束等待。

那么它是如何实现的呢？实现 原理非常简单：

```java
public class CountDownLatch {
   	//同样是通过内部类实现AbstractQueuedSynchronizer
    private static final class Sync extends AbstractQueuedSynchronizer {
        
        Sync(int count) {   //这里直接使用AQS的state作为计数器（可见state能被玩出各种花样），也就是说一开始就加了count把共享锁，当线程调用countdown时，就解一层锁
            setState(count);
        }

        int getCount() {
            return getState();
        }

      	//采用共享锁机制，因为可以被不同的线程countdown，所以实现的tryAcquireShared和tryReleaseShared
      	//获取这把共享锁其实就是去等待state被其他线程减到0
        protected int tryAcquireShared(int acquires) {
            return (getState() == 0) ? 1 : -1;
        }

        protected boolean tryReleaseShared(int releases) {
            // 每次执行都会将state值-1，直到为0
            for (;;) {
                int c = getState();
                if (c == 0)
                    return false;   //如果已经是0了，那就false
                int nextc = c-1;
                if (compareAndSetState(c, nextc))   //CAS设置state值，失败直接下一轮循环
                    return nextc == 0;    //返回c-1之后，是不是0，如果是那就true，否则false，也就是说只有刚好减到0的时候才会返回true
            }
        }
    }

    private final Sync sync;

    public CountDownLatch(int count) {
        if (count < 0) throw new IllegalArgumentException("count < 0");  //count那肯定不能小于0啊
        this.sync = new Sync(count);   //构造Sync对象，将count作为state初始值
    }

   	//通过acquireSharedInterruptibly方法获取共享锁，但是如果state不为0，那么会被持续阻塞，详细原理下面讲
    public void await() throws InterruptedException {
        sync.acquireSharedInterruptibly(1);
    }

    //同上，但是会超时
    public boolean await(long timeout, TimeUnit unit)
        throws InterruptedException {
        return sync.tryAcquireSharedNanos(1, unit.toNanos(timeout));
    }

   	//countDown其实就是解锁一次
    public void countDown() {
        sync.releaseShared(1);
    }

    //获取当前的计数，也就是AQS中state的值
    public long getCount() {
        return sync.getCount();
    }

    //这个就不说了
    public String toString() {
        return super.toString() + "[Count = " + sync.getCount() + "]";
    }
}
```

在深入讲解之前，我们先大致了解一下CountDownLatch的基本实现思路：

* 利用共享锁实现
* 在一开始的时候就是已经上了count层锁的状态，也就是`state = count`
* `await()`就是加共享锁，但是必须`state`为`0`才能加锁成功，否则按照AQS的机制，会进入等待队列阻塞，加锁成功后结束阻塞
* `countDown()`就是解`1`层锁，也就是靠这个方法一点一点把`state`的值减到`0`

由于我们前面只对独占锁进行了讲解，没有对共享锁进行讲解，这里还是稍微提一下它：

```java
public final void acquireShared(int arg) {
    if (tryAcquireShared(arg) < 0)   //上来就调用tryAcquireShared尝试以共享模式获取锁，小于0则失败，上面判断的是state==0返回1，否则-1，也就是说如果计数器不为0，那么这里会判断成功
        doAcquireShared(arg);   //计数器不为0的时候，按照它的机制，那么会阻塞，所以我们来看看doAcquireShared中是怎么进行阻塞的
}
```

```java
private void doAcquireShared(int arg) {
    final Node node = addWaiter(Node.SHARED);   //向等待队列中添加一个新的共享模式结点
    boolean failed = true;
    try {
        boolean interrupted = false;
        for (;;) {    //无限循环
            final Node p = node.predecessor();   //获取当前节点的前驱的结点
            if (p == head) {    //如果p就是头结点，那么说明当前结点就是第一个等待节点
                int r = tryAcquireShared(arg);    //会再次尝试获取共享锁
                if (r >= 0) {      //要是获取成功
                    setHeadAndPropagate(node, r);   //那么就将当前节点设定为新的头结点，并且会继续唤醒后继节点
                    p.next = null; // help GC
                    if (interrupted)
                        selfInterrupt();
                    failed = false;
                    return;
                }
            }
            if (shouldParkAfterFailedAcquire(p, node) &&   //和独占模式下一样的操作，这里不多说了
                parkAndCheckInterrupt())
                interrupted = true;
        }
    } finally {
        if (failed)
            cancelAcquire(node);   //如果最后都还是没获取到，那么就cancel
    }
}
//其实感觉大体上和独占模式的获取有点像，但是它多了个传播机制，会继续唤醒后续节点
```

```java
private void setHeadAndPropagate(Node node, int propagate) {
    Node h = head; // 取出头结点并将当前节点设定为新的头结点
    setHead(node);
    
  	//因为一个线程成功获取到共享锁之后，有可能剩下的等待中的节点也有机会拿到共享锁
    if (propagate > 0 || h == null || h.waitStatus < 0 ||
        (h = head) == null || h.waitStatus < 0) {   //如果propagate大于0（表示共享锁还能继续获取）或是h.waitStatus < 0，这是由于在其他线程释放共享锁时，doReleaseShared会将状态设定为PROPAGATE表示可以传播唤醒，后面会讲
        Node s = node.next;
        if (s == null || s.isShared())
            doReleaseShared();   //继续唤醒下一个等待节点
    }
}
```

我们接着来看，它的countdown过程：

```java
public final boolean releaseShared(int arg) {
    if (tryReleaseShared(arg)) {   //直接尝试释放锁，如果成功返回true（在CountDownLatch中只有state减到0的那一次，会返回true）
        doReleaseShared();    //这里也会调用doReleaseShared继续唤醒后面的结点
        return true;
    }
    return false;   //其他情况false
  									//不过这里countdown并没有用到这些返回值
}
```

```java
private void doReleaseShared() {
    for (;;) {   //无限循环
        Node h = head;    //获取头结点
        if (h != null && h != tail) {    //如果头结点不为空且头结点不是尾结点，那么说明等待队列中存在节点
            int ws = h.waitStatus;    //取一下头结点的等待状态
            if (ws == Node.SIGNAL) {    //如果是SIGNAL，那么就CAS将头结点的状态设定为初始值
                if (!compareAndSetWaitStatus(h, Node.SIGNAL, 0))
                    continue;            //失败就开下一轮循环重来
                unparkSuccessor(h);    //和独占模式一样，当锁被释放，都会唤醒头结点的后继节点，doAcquireShared循环继续，如果成功，那么根据setHeadAndPropagate，又会继续调用当前方法，不断地传播下去，让后面的线程一个一个地获取到共享锁，直到不能再继续获取为止
            }
            else if (ws == 0 &&
                     !compareAndSetWaitStatus(h, 0, Node.PROPAGATE))   //如果等待状态是默认值0，那么说明后继节点已经被唤醒，直接将状态设定为PROPAGATE，它代表在后续获取资源的时候，够向后面传播
                continue;                //失败就开下一轮循环重来
        }
        if (h == head)                   // 如果头结点发生了变化，不会break，而是继续循环，否则直接break退出
            break;
    }
}
```

可能看完之后还是有点乱，我们再来理一下：

* 共享锁是线程共享的，同一时刻能有多个线程拥有共享锁。
* 如果一个线程刚获取了共享锁，那么在其之后等待的线程也很有可能能够获取到锁，所以得传播下去继续尝试唤醒后面的结点，不像独占锁，独占的压根不需要考虑这些。
* 如果一个线程刚释放了锁，不管是独占锁还是共享锁，都需要唤醒后续等待结点的线程。

回到CountDownLatch，再结合整个AQS共享锁的实现机制，进行一次完整的推导，看明白还是比较简单的。

### 循环屏障 CyclicBarrier

好比一场游戏，我们必须等待房间内人数足够之后才能开始，并且游戏开始之后玩家需要同时进入游戏以保证公平性。

假如现在游戏房间内一共5人，但是游戏开始需要10人，所以我们必须等待剩下5人到来之后才能开始游戏，并且保证游戏开始时所有玩家都是同时进入，那么怎么实现这个功能呢？我们可以使用CyclicBarrier，翻译过来就是循环屏障，那么这个屏障正式为了解决这个问题而出现的。

```java
public static void main(String[] args) {
    CyclicBarrier barrier = new CyclicBarrier(10,   //创建一个初始值为10的循环屏障
                () -> System.out.println("飞机马上就要起飞了，各位特种兵请准备！"));   //人等够之后执行的任务
    for (int i = 0; i < 10; i++) {
        int finalI = i;
        new Thread(() -> {
            try {
                Thread.sleep((long) (2000 * new Random().nextDouble()));
                System.out.println("玩家 "+ finalI +" 进入房间进行等待... ("+barrier.getNumberWaiting()+"/10)");

                barrier.await();    //调用await方法进行等待，直到等待的线程足够多为止

                //开始游戏，所有玩家一起进入游戏
                System.out.println("玩家 "+ finalI +" 进入游戏！");
            } catch (InterruptedException | BrokenBarrierException e) {
                e.printStackTrace();
            }
        }).start();
    }
}
```

可以看到，循环屏障会不断阻挡线程，直到被阻挡的线程足够多时，才能一起冲破屏障，并且在冲破屏障时，我们也可以做一些其他的任务。这和人多力量大的道理是差不多的，当人足够多时方能冲破阻碍，到达美好的明天。当然，屏障由于是可循环的，所以它在被冲破后，会重新开始计数，继续阻挡后续的线程：

```java
public static void main(String[] args) {
    CyclicBarrier barrier = new CyclicBarrier(5);  //创建一个初始值为5的循环屏障

    for (int i = 0; i < 10; i++) {   //创建5个线程
        int finalI = i;
        new Thread(() -> {
            try {
                Thread.sleep((long) (2000 * new Random().nextDouble()));
                System.out.println("玩家 "+ finalI +" 进入房间进行等待... ("+barrier.getNumberWaiting()+"/5)");

                barrier.await();    //调用await方法进行等待，直到等待线程到达5才会一起继续执行

                //人数到齐之后，可以开始游戏了
                System.out.println("玩家 "+ finalI +" 进入游戏！");
            } catch (InterruptedException | BrokenBarrierException e) {
                e.printStackTrace();
            }
        }).start();
    }
}
```

可以看到，通过使用循环屏障，我们可以对线程进行一波一波地放行，每一波都放行5个线程，当然除了自动重置之外，我们也可以调用`reset()`方法来手动进行重置操作，同样会重新计数：

```java
public static void main(String[] args) throws InterruptedException {
    CyclicBarrier barrier = new CyclicBarrier(5);  //创建一个初始值为10的计数器锁

    for (int i = 0; i < 3; i++)
        new Thread(() -> {
            try {
                barrier.await();
            } catch (InterruptedException | BrokenBarrierException e) {
                e.printStackTrace();
            }
        }).start();

    Thread.sleep(500);   //等一下上面的线程开始运行
    System.out.println("当前屏障前的等待线程数："+barrier.getNumberWaiting());

    barrier.reset();
    System.out.println("重置后屏障前的等待线程数："+barrier.getNumberWaiting());
}
```

可以看到，在调用`reset()`之后，处于等待状态下的线程，全部被中断并且抛出BrokenBarrierException异常，循环屏障等待线程数归零。那么要是处于等待状态下的线程被中断了呢？屏障的线程等待数量会不会自动减少？

```java
public static void main(String[] args) throws InterruptedException {
    CyclicBarrier barrier = new CyclicBarrier(10);
    Runnable r = () -> {
        try {
            barrier.await();
        } catch (InterruptedException | BrokenBarrierException e) {
            e.printStackTrace();
        }
    };
    Thread t = new Thread(r);
    t.start();
    t.interrupt();
    new Thread(r).start();
}
```

可以看到，当`await()`状态下的线程被中断，那么屏障会直接变成损坏状态，一旦屏障损坏，那么这一轮就无法再做任何等待操作了。也就是说，本来大家计划一起合力冲破屏障，结果有一个人摆烂中途退出了，那么所有人的努力都前功尽弃，这一轮的屏障也不可能再被冲破了（所以CyclicBarrier告诉我们，不要做那个害群之马，要相信你的团队，不然没有好果汁吃），只能进行`reset()`重置操作进行重置才能恢复正常。

乍一看，怎么感觉和之前讲的CountDownLatch有点像，好了，这里就得区分一下了，千万别搞混：

* CountDownLatch：
  1. 它只能使用一次，是一个一次性的工具
  2. 它是一个或多个线程用于等待其他线程完成的同步工具
* CyclicBarrier
  1. 它可以反复使用，允许自动或手动重置计数
  2. 它是让一定数量的线程在同一时间开始运行的同步工具

我们接着来看循环屏障的实现细节：

```java
public class CyclicBarrier {
    //内部类，存放broken标记，表示屏障是否损坏，损坏的屏障是无法正常工作的
    private static class Generation {
        boolean broken = false;
    }

    /** 内部维护一个可重入锁 */
    private final ReentrantLock lock = new ReentrantLock();
    /** 再维护一个Condition */
    private final Condition trip = lock.newCondition();
    /** 这个就是屏障的最大阻挡容量，就是构造方法传入的初始值 */
    private final int parties;
    /* 在屏障破裂时做的事情 */
    private final Runnable barrierCommand;
    /** 当前这一轮的Generation对象，每一轮都有一个新的，用于保存broken标记 */
    private Generation generation = new Generation();

    //默认为最大阻挡容量，每来一个线程-1，和CountDownLatch挺像，当屏障破裂或是被重置时，都会将其重置为最大阻挡容量
    private int count;

  	//构造方法
  	public CyclicBarrier(int parties, Runnable barrierAction) {
        if (parties <= 0) throw new IllegalArgumentException();
        this.parties = parties;
        this.count = parties;
        this.barrierCommand = barrierAction;
    }
  
    public CyclicBarrier(int parties) {
        this(parties, null);
    }
  
    //开启下一轮屏障，一般屏障被冲破之后，就自动重置了，进入到下一轮
    private void nextGeneration() {
        // 唤醒所有等待状态的线程
        trip.signalAll();
        // 重置count的值
        count = parties;
      	//创建新的Generation对象
        generation = new Generation();
    }

    //破坏当前屏障，变为损坏状态，之后就不能再使用了，除非重置
    private void breakBarrier() {
        generation.broken = true;
        count = parties;
        trip.signalAll();
    }
  
  	//开始等待
  	public int await() throws InterruptedException, BrokenBarrierException {
        try {
            return dowait(false, 0L);
        } catch (TimeoutException toe) {
            throw new Error(toe); // 因为这里没有使用定时机制，不可能发生异常，如果发生怕是出了错误
        }
    }
    
  	//可超时的等待
    public int await(long timeout, TimeUnit unit)
        throws InterruptedException,
               BrokenBarrierException,
               TimeoutException {
        return dowait(true, unit.toNanos(timeout));
    }

    //这里就是真正的等待流程了，让我们细细道来
    private int dowait(boolean timed, long nanos)
        throws InterruptedException, BrokenBarrierException,
               TimeoutException {
        final ReentrantLock lock = this.lock;
        lock.lock();   //加锁，注意，因为多个线程都会调用await方法，因此只有一个线程能进，其他都被卡着了
        try {
            final Generation g = generation;   //获取当前这一轮屏障的Generation对象

            if (g.broken)
                throw new BrokenBarrierException();   //如果这一轮屏障已经损坏，那就没办法使用了

            if (Thread.interrupted()) {   //如果当前等待状态的线程被中断，那么会直接破坏掉屏障，并抛出中断异常（破坏屏障的第1种情况）
                breakBarrier();
                throw new InterruptedException();
            }

            int index = --count;     //如果上面都没有出现不正常，那么就走正常流程，首先count自减并赋值给index，index表示当前是等待的第几个线程
            if (index == 0) {  // 如果自减之后就是0了，那么说明来的线程已经足够，可以冲破屏障了
                boolean ranAction = false;
                try {
                    final Runnable command = barrierCommand;
                    if (command != null)
                        command.run();   //执行冲破屏障后的任务，如果这里抛异常了，那么会进finally
                    ranAction = true;
                    nextGeneration();   //一切正常，开启下一轮屏障（方法进入之后会唤醒所有等待的线程，这样所有的线程都可以同时继续运行了）然后返回0，注意最下面finally中会解锁，不然其他线程唤醒了也拿不到锁啊
                    return 0;
                } finally {
                    if (!ranAction)   //如果是上面出现异常进来的，那么也会直接破坏屏障（破坏屏障的第2种情况）
                        breakBarrier();
                }
            }

            // 能走到这里，那么说明当前等待的线程数还不够多，不足以冲破屏障
            for (;;) {   //无限循环，一直等，等到能冲破屏障或是出现异常为止
                try {
                    if (!timed)
                        trip.await();    //如果不是定时的，那么就直接永久等待
                    else if (nanos > 0L)
                        nanos = trip.awaitNanos(nanos);   //否则最多等一段时间
                } catch (InterruptedException ie) {    //等的时候会判断是否被中断（依然是破坏屏障的第1种情况）
                    if (g == generation && ! g.broken) {
                        breakBarrier();
                        throw ie;
                    } else {
                        Thread.currentThread().interrupt();
                    }
                }

                if (g.broken)
                    throw new BrokenBarrierException();   //如果线程被唤醒之后发现屏障已经被破坏，那么直接抛异常

                if (g != generation)   //成功冲破屏障开启下一轮，那么直接返回当前是第几个等待的线程。
                    return index;

                if (timed && nanos <= 0L) {   //线程等待超时，也会破坏屏障（破坏屏障的第3种情况）然后抛异常
                    breakBarrier();
                    throw new TimeoutException();
                }
            }
        } finally {
            lock.unlock();    //最后别忘了解锁，不然其他线程拿不到锁
        }
    }

  	//不多说了
    public int getParties() {
        return parties;
    }

  	//判断是否被破坏，也是加锁访问，因为有可能这时有其他线程正在执行dowait
    public boolean isBroken() {
        final ReentrantLock lock = this.lock;
        lock.lock();
        try {
            return generation.broken;
        } finally {
            lock.unlock();
        }
    }

  	//重置操作，也要加锁
    public void reset() {
        final ReentrantLock lock = this.lock;
        lock.lock();
        try {
            breakBarrier();   // 先破坏这一轮的线程，注意这个方法会先破坏再唤醒所有等待的线程，那么所有等待的线程会直接抛BrokenBarrierException异常（详情请看上方dowait倒数第13行）
            nextGeneration(); // 开启下一轮
        } finally {
            lock.unlock();
        }
    }
	
  	//获取等待线程数量，也要加锁
    public int getNumberWaiting() {
        final ReentrantLock lock = this.lock;
        lock.lock();
        try {
            return parties - count;   //最大容量 - 当前剩余容量 = 正在等待线程数
        } finally {
            lock.unlock();
        }
    }
}
```

看完了CyclicBarrier的源码之后，是不是感觉比CountDownLatch更简单一些？

### 信号量 Semaphore

还记得我们在《操作系统》中学习的信号量机制吗？它在解决进程之间的同步问题中起着非常大的作用。

> 信号量(Semaphore)，有时被称为信号灯，是在多线程环境下使用的一种设施，是可以用来保证两个或多个关键代码段不被并发调用。在进入一个关键代码段之前，线程必须获取一个信号量；一旦该关键代码段完成了，那么该线程必须释放信号量。其它想进入该关键代码段的线程必须等待直到第一个线程释放信号量。

通过使用信号量，我们可以决定某个资源同一时间能够被访问的最大线程数，它相当于对某个资源的访问进行了流量控制。简单来说，它就是一个可以被N个线程占用的排它锁（因此也支持公平和非公平模式），我们可以在最开始设定Semaphore的许可证数量，每个线程都可以获得1个或n个许可证，当许可证耗尽或不足以供其他线程获取时，其他线程将被阻塞。

```java
public static void main(String[] args) throws ExecutionException, InterruptedException {
    //每一个Semaphore都会在一开始获得指定的许可证数数量，也就是许可证配额
    Semaphore semaphore = new Semaphore(2);   //许可证配额设定为2

    for (int i = 0; i < 3; i++) {
        new Thread(() -> {
            try {
                semaphore.acquire();   //申请一个许可证
                System.out.println("许可证申请成功！");
                semaphore.release();   //归还一个许可证
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }).start();
    }
}
```

```java
public static void main(String[] args) throws ExecutionException, InterruptedException {
    //每一个Semaphore都会在一开始获得指定的许可证数数量，也就是许可证配额
    Semaphore semaphore = new Semaphore(3);   //许可证配额设定为3

    for (int i = 0; i < 2; i++)
        new Thread(() -> {
            try {
                semaphore.acquire(2);    //一次性申请两个许可证
                System.out.println("许可证申请成功！");
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }).start();
    
}
```

我们也可以通过Semaphore获取一些常规信息：

```java
public static void main(String[] args) throws InterruptedException {
    Semaphore semaphore = new Semaphore(3);   //只配置一个许可证，5个线程进行争抢，不内卷还想要许可证？
    for (int i = 0; i < 5; i++)
        new Thread(semaphore::acquireUninterruptibly).start();   //可以以不响应中断（主要是能简写一行，方便）
    Thread.sleep(500);
    System.out.println("剩余许可证数量："+semaphore.availablePermits());
    System.out.println("是否存在线程等待许可证："+(semaphore.hasQueuedThreads() ? "是" : "否"));
    System.out.println("等待许可证线程数量："+semaphore.getQueueLength());
}
```

我们可以手动回收掉所有的许可证：

```java
public static void main(String[] args) throws InterruptedException {
    Semaphore semaphore = new Semaphore(3);
    new Thread(semaphore::acquireUninterruptibly).start();
    Thread.sleep(500);
    System.out.println("收回剩余许可数量："+semaphore.drainPermits());   //直接回收掉剩余的许可证
}
```

这里我们模拟一下，比如现在有10个线程同时进行任务，任务要求是执行某个方法，但是这个方法最多同时只能由5个线程执行，这里我们使用信号量就非常合适。

### 数据交换 Exchanger

线程之间的数据传递也可以这么简单。

使用Exchanger，它能够实现线程之间的数据交换：

```java
public static void main(String[] args) throws InterruptedException {
    Exchanger<String> exchanger = new Exchanger<>();
    new Thread(() -> {
        try {
            System.out.println("收到主线程传递的交换数据："+exchanger.exchange("AAAA"));
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }).start();
    System.out.println("收到子线程传递的交换数据："+exchanger.exchange("BBBB"));
}
```

在调用`exchange`方法后，当前线程会等待其他线程调用同一个exchanger对象的`exchange`方法，当另一个线程也调用之后，方法会返回对方线程传入的参数。

可见功能还是比较简单的。

### Fork/Join框架

在JDK7时，出现了一个新的框架用于并行执行任务，它的目的是为了把大型任务拆分为多个小任务，最后汇总多个小任务的结果，得到整大任务的结果，并且这些小任务都是同时在进行，大大提高运算效率。Fork就是拆分，Join就是合并。

我们来演示一下实际的情况，比如一个算式：18x7+36x8+9x77+8x53，可以拆分为四个小任务：18x7、36x8、9x77、8x53，最后我们只需要将这四个任务的结果加起来，就是我们原本算式的结果了，有点归并排序的味道。

![image-20230306172442485](/juc-img/l6iXQ4N2TfnZDMJ.png)

它不仅仅只是拆分任务并使用多线程，而且还可以利用工作窃取算法，提高线程的利用率。

> **工作窃取算法：** 是指某个线程从其他队列里窃取任务来执行。一个大任务分割为若干个互不依赖的子任务，为了减少线程间的竞争，把这些子任务分别放到不同的队列里，并为每个队列创建一个单独的线程来执行队列里的任务，线程和队列一一对应。但是有的线程会先把自己队列里的任务干完，而其他线程对应的队列里还有任务待处理。干完活的线程与其等着，不如帮其他线程干活，于是它就去其他线程的队列里窃取一个任务来执行。

![image-20230306172457006](/juc-img/DP7yj6pBZFGLoQb.png)

现在我们来看看如何使用它，这里以计算1-1000的和为例，我们可以将其拆分为8个小段的数相加，比如1-125、126-250... ，最后再汇总即可，它也是依靠线程池来实现的：

```java
public class Main {
    public static void main(String[] args) throws InterruptedException, ExecutionException {
        ForkJoinPool pool = new ForkJoinPool();
        System.out.println(pool.submit(new SubTask(1, 1000)).get());
    }


  	//继承RecursiveTask，这样才可以作为一个任务，泛型就是计算结果类型
    private static class SubTask extends RecursiveTask<Integer> {
        private final int start;   //比如我们要计算一个范围内所有数的和，那么就需要限定一下范围，这里用了两个int存放
        private final int end;

        public SubTask(int start, int end) {
            this.start = start;
            this.end = end;
        }

        @Override
        protected Integer compute() {
            if(end - start > 125) {    //每个任务最多计算125个数的和，如果大于继续拆分，小于就可以开始算了
                SubTask subTask1 = new SubTask(start, (end + start) / 2);
                subTask1.fork();    //会继续划分子任务执行
                SubTask subTask2 = new SubTask((end + start) / 2 + 1, end);
                subTask2.fork();   //会继续划分子任务执行
                return subTask1.join() + subTask2.join();   //越玩越有递归那味了
            } else {
                System.out.println(Thread.currentThread().getName()+" 开始计算 "+start+"-"+end+" 的值!");
                int res = 0;
                for (int i = start; i <= end; i++) {
                    res += i;
                }
                return res;   //返回的结果会作为join的结果
            }
        }
    }
}
```

```
ForkJoinPool-1-worker-2 开始计算 1-125 的值!
ForkJoinPool-1-worker-2 开始计算 126-250 的值!
ForkJoinPool-1-worker-0 开始计算 376-500 的值!
ForkJoinPool-1-worker-6 开始计算 751-875 的值!
ForkJoinPool-1-worker-3 开始计算 626-750 的值!
ForkJoinPool-1-worker-5 开始计算 501-625 的值!
ForkJoinPool-1-worker-4 开始计算 251-375 的值!
ForkJoinPool-1-worker-7 开始计算 876-1000 的值!
500500
```

可以看到，结果非常正确，但是整个计算任务实际上是拆分为了8个子任务同时完成的，结合多线程，原本的单线程任务，在多线程的加持下速度成倍提升。

包括Arrays工具类提供的并行排序也是利用了ForkJoinPool来实现：

```java
public static void parallelSort(byte[] a) {
    int n = a.length, p, g;
    if (n <= MIN_ARRAY_SORT_GRAN ||
        (p = ForkJoinPool.getCommonPoolParallelism()) == 1)
        DualPivotQuicksort.sort(a, 0, n - 1);
    else
        new ArraysParallelSortHelpers.FJByte.Sorter
            (null, a, new byte[n], 0, n, 0,
             ((g = n / (p << 2)) <= MIN_ARRAY_SORT_GRAN) ?
             MIN_ARRAY_SORT_GRAN : g).invoke();
}
```

并行排序的性能在多核心CPU环境下，肯定是优于普通排序的，并且排序规模越大优势越显著。

#### 异步编程利器 **CompeletableFuture**（Java8）

> https://blog.csdn.net/ThinkWon/article/details/123390393
>
> https://zhuanlan.zhihu.com/p/13791775815

`CompletableFuture.supplyAsync()` 是 Java 8 引入的 **异步编程利器**，用于**以非阻塞方式执行一个有返回值的任务**，并返回一个 `CompletableFuture<T>` 对象，后续可通过链式调用处理结果。

一、基本定义

```
public static <U> CompletableFuture<U> supplyAsync(Supplier<U> supplier)
```

- **`Supplier<U>`**：一个函数式接口，表示“提供”一个值（无参，有返回值）。
- **返回值**：`CompletableFuture<U>`，代表一个**异步计算的结果**（可能还没完成）。

> ✅ 它是 **异步 + 有返回值** 场景的标准入口。

二、核心特点

| 特性           | 说明                                                         |
| -------------- | ------------------------------------------------------------ |
| **异步执行**   | 任务提交后立即返回，不阻塞当前线程                           |
| **默认线程池** | 使用 `ForkJoinPool.commonPool()`（通常是一个守护线程池）     |
| **可组合性**   | 支持 `.thenApply()`, `.thenAccept()`, `.thenCompose()`, `.exceptionally()` 等链式操作 |
| **非阻塞**     | 主线程可以继续做其他事，结果通过回调或 `join()/get()` 获取   |

三、基本用法示例

1、最简单用法

```
CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
    // 模拟耗时操作（如调用远程服务）
    try { Thread.sleep(2000); } catch (InterruptedException e) {}
    return "Hello from async task!";
});

// 主线程不阻塞！可以做其他事情
System.out.println("Doing other work...");

// 阻塞等待结果（谨慎使用，仅在需要时）
String result = future.join(); // 或 future.get()
System.out.println(result);
```

> 输出：

```
Doing other work...
（2秒后）
Hello from async task!
```

2、链式处理（推荐！避免阻塞）

```
CompletableFuture.supplyAsync(() -> {
    return fetchDataFromAPI(); // 返回 User 对象
})
.thenApply(user -> user.getName())          // 转换：User → String
.thenAccept(name -> System.out.println("Name: " + name)) // 消费结果
.exceptionally(ex -> {
    System.err.println("Error: " + ex.getMessage());
    return null;
});
```

> ✅ 整个过程**无阻塞**，异常也能统一处理。

3、指定自定义线程池（重要！）

**不要在生产环境依赖默认线程池**（`ForkJoinPool.commonPool()` 是共享的，可能被其他任务占满）。

```
ExecutorService executor = Executors.newFixedThreadPool(4);

CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
    return doHeavyWork();
}, executor); // 显式指定线程池

// 记得关闭线程池（应用生命周期管理）
executor.shutdown();
```

> ✅ **最佳实践：始终传入自定义线程池**，便于控制资源、监控和隔离。

四、与 `runAsync()` 的区别

| 方法                       | 是否有返回值 | 函数式接口   |
| -------------------------- | ------------ | ------------ |
| `supplyAsync(Supplier<T>)` | ✅ 有返回值   | `T get()`    |
| `runAsync(Runnable)`       | ❌ 无返回值   | `void run()` |

```
// 无返回值
CompletableFuture.runAsync(() -> System.out.println("Task done"));

// 有返回值
CompletableFuture<String> f = CompletableFuture.supplyAsync(() -> "Result");
```

五、常见应用场景

1. **并行调用多个服务，合并结果**

   ```
   CompletableFuture<User> userFuture = CompletableFuture.supplyAsync(this::fetchUser);
   CompletableFuture<Order> orderFuture = CompletableFuture.supplyAsync(this::fetchOrder);
   
   CompletableFuture<Void> combined = 
       userFuture.thenAcceptBoth(orderFuture, (user, order) -> {
           // 处理 user 和 order
       });
   ```

2. **超时控制**

   ```
   CompletableFuture<String> future = CompletableFuture.supplyAsync(this::slowCall);
   String result = future.get(3, TimeUnit.SECONDS); // 3秒超时
   ```

3. **异步非阻塞 I/O（配合 WebFlux、响应式编程等）**

六、注意事项 ⚠️

1. **不要滥用 `.join()` 或 `.get()`**
   它们会**阻塞当前线程**，违背异步初衷。尽量用 `.thenApply()` 等回调方式。
2. **异常处理必须显式处理**
   未处理的异常会被“吞掉”，导致静默失败。务必用 `.exceptionally()` 或 `.handle()`。
3. **线程池要合理配置**
   默认线程池不适合 I/O 密集型任务（应使用更多线程），CPU 密集型则线程数 ≈ CPU 核数。

总结

> `CompletableFuture.supplyAsync()` = **“启动一个异步任务，并拿到一个未来能取到结果的凭证”**。

它是 Java 实现 **异步、非阻塞、可组合并发逻辑** 的核心工具，广泛用于微服务调用、批量处理、响应式编程等场景。

## 十三、并发容器与阻塞队列

### 传统同步容器线程安全吗

我们来测试一下，100个线程同时向ArrayList中添加元素会怎么样：

```java
public class Main {
    public static void main(String[] args) {
        List<String> list = new ArrayList<>();
        Runnable r = () -> {
            for (int i = 0; i < 100; i++)
                list.add("lbwnb");
        };
        for (int i = 0; i < 100; i++)
            new Thread(r).start();
      	TimeUnit.SECONDS.sleep(1);
        System.out.println(list.size());
    }
}
```

不出意外的话，肯定是会报错的：

```
Exception in thread "Thread-0" java.lang.ArrayIndexOutOfBoundsException: 73
	at java.util.ArrayList.add(ArrayList.java:465)
	at com.test.Main.lambda$main$0(Main.java:13)
	at java.lang.Thread.run(Thread.java:750)
Exception in thread "Thread-19" java.lang.ArrayIndexOutOfBoundsException: 1851
	at java.util.ArrayList.add(ArrayList.java:465)
	at com.test.Main.lambda$main$0(Main.java:13)
	at java.lang.Thread.run(Thread.java:750)
9773
```

那么我们来看看报的什么错，从栈追踪信息可以看出，是add方法出现了问题：

```java
public boolean add(E e) {
    ensureCapacityInternal(size + 1);  // Increments modCount!!
    elementData[size++] = e;   //这一句出现了数组越界
    return true;
}
```

也就是说，同一时间其他线程也在疯狂向数组中添加元素，那么这个时候有可能在`ensureCapacityInternal`（确认容量足够）执行之后，`elementData[size++] = e;`执行之前，其他线程插入了元素，导致size的值超出了数组容量。这些在单线程的情况下不可能发生的问题，在多线程下就慢慢出现了。

### 并发容器<a id="并发容器"></a>

https://javabetter.cn/thread/map.html

Java 并发包（`java.util.concurrent`）提供了多种线程安全的容器，主要分为以下几类：

1、并发 Map

- **`ConcurrentHashMap`**
  高性能线程安全的哈希表，支持高并发读写，分段锁（JDK 7）或 CAS + synchronized（JDK 8+）。
- **`ConcurrentSkipListMap`**
  基于跳表的有序并发 Map，支持按 key 排序。

2、并发 Set

- **`CopyOnWriteArraySet`**
  基于 `CopyOnWriteArrayList`，写时复制，适合读多写少场景。
- **`ConcurrentSkipListSet`**
  基于 `ConcurrentSkipListMap`，有序、线程安全。

3、并发 List

- **`CopyOnWriteArrayList`**
  写操作复制整个数组，读操作无锁。适用于**读远多于写**的场景（如监听器列表）。

> ⚠️ 注意：**没有 `ConcurrentArrayList`**！因为 List 的随机访问和索引修改在并发下很难高效实现。

4、并发 Queue（非阻塞）

- **`ConcurrentLinkedQueue`**
  无界、非阻塞、FIFO，基于 CAS 实现，高性能。
- **`ConcurrentLinkedDeque`**
  无界、非阻塞、双端队列。

> 区别：**阻塞队列（BlockingQueue）在空/满时会阻塞线程；非阻塞队列（如 ConcurrentLinkedQueue）直接返回 true/false 或 null**。

#### 阻塞队列

https://javabetter.cn/thread/BlockingQueue.html#arrayblockingqueue

![image-20260117162016000](/juc-img/image-20260117162016000.png)

除了常用的容器类之外，JUC还提供了各种各样的阻塞队列，用于不同的工作场景。

阻塞队列本身也是队列，但是它是适用于多线程环境下的，基于ReentrantLock实现的，它的接口定义如下：

```java
public interface BlockingQueue<E> extends Queue<E> {
   	boolean add(E e);

    //入队，如果队列已满，返回false否则返回true（非阻塞）
    boolean offer(E e);

    //入队，如果队列已满，阻塞线程直到能入队为止
    void put(E e) throws InterruptedException;

    //入队，如果队列已满，阻塞线程直到能入队或超时、中断为止，入队成功返回true否则false
    boolean offer(E e, long timeout, TimeUnit unit)
        throws InterruptedException;

    //出队，如果队列为空，阻塞线程直到能出队为止
    E take() throws InterruptedException;

    //出队，如果队列为空，阻塞线程直到能出队超时、中断为止，出队成功正常返回，否则返回null
    E poll(long timeout, TimeUnit unit)
        throws InterruptedException;

    //返回此队列理想情况下（在没有内存或资源限制的情况下）可以不阻塞地入队的数量，如果没有限制，则返回 Integer.MAX_VALUE
    int remainingCapacity();

    boolean remove(Object o);

    public boolean contains(Object o);

  	//一次性从BlockingQueue中获取所有可用的数据对象（还可以指定获取数据的个数）
    int drainTo(Collection<? super E> c);

    int drainTo(Collection<? super E> c, int maxElements);
```

| 方法                      | 队列满时的行为                         | 是否阻塞   | 返回值/异常                             | 适用场景                                 |
| ------------------------- | -------------------------------------- | ---------- | --------------------------------------- | ---------------------------------------- |
| `add(e)`                  | 抛出 `IllegalStateException`           | ❌ 不阻塞   | 成功返回 `true`，失败抛异常             | 适合确定队列不会满，或希望用异常表示错误 |
| `offer(e)`                | 返回 `false`                           | ❌ 不阻塞   | `boolean`                               | 希望快速失败，不希望异常控制流           |
| `offer(e, timeout, unit)` | 等待最多 `timeout`，仍满则返回 `false` | ✅ 有限阻塞 | `boolean`                               | 可接受短暂等待                           |
| `put(e)`                  | 一直阻塞直到有空间                     | ✅ 无限阻塞 | `void`（可能抛 `InterruptedException`） | 必须入队，生产者可等待                   |

| 实现类                  | 特点                                                         |
| ----------------------- | ------------------------------------------------------------ |
| `ArrayBlockingQueue`    | 有界、基于数组、FIFO、可选公平/非公平锁                      |
| `LinkedBlockingQueue`   | 可选有界（默认无界）、基于链表、FIFO、高吞吐                 |
| `SynchronousQueue`      | 容量为0，每个 put 必须等待 take，反之亦然；常用于线程池（如 Executors.newCachedThreadPool） |
| `PriorityBlockingQueue` | 无界、按优先级排序（需实现 Comparable 或传 Comparator）      |
| `DelayQueue`            | 无界、元素只有在延迟到期后才能被取出（需实现 Delayed 接口）  |
| `LinkedTransferQueue`   | 无界、支持 transfer() 操作（更高效的生产者-消费者协作）      |
| `LinkedBlockingDeque`   | 双端阻塞队列（BlockingDeque 接口），支持从两端插入/移除      |

1、以ArrayBlockingQueue为例进行源码解读，先来看看构造方法：

```java
final ReentrantLock lock;

private final Condition notEmpty;

private final Condition notFull;

public ArrayBlockingQueue(int capacity, boolean fair) {
    if (capacity <= 0)
        throw new IllegalArgumentException();
    this.items = new Object[capacity];
    lock = new ReentrantLock(fair);   //底层采用锁机制保证线程安全性，这里我们可以选择使用公平锁或是非公平锁
    notEmpty = lock.newCondition();   //这里创建了两个Condition（都属于lock）一会用于入队和出队的线程阻塞控制
    notFull =  lock.newCondition();
}
```

接着来看`put`和`offer`方法是如何实现的：

```java
public boolean offer(E e) {
    checkNotNull(e);
    final ReentrantLock lock = this.lock;    //可以看到这里也是使用了类里面的ReentrantLock进行加锁操作
    lock.lock();    //保证同一时间只有一个线程进入
    try {
        if (count == items.length)   //直接看看队列是否已满，如果没满则直接入队，如果已满则返回false
            return false;
        else {
            enqueue(e);
            return true;
        }
    } finally {
        lock.unlock();
    }
}

public void put(E e) throws InterruptedException {
    checkNotNull(e);
    final ReentrantLock lock = this.lock;    //同样的，需要进行加锁操作
    lock.lockInterruptibly();    //注意这里是可以响应中断的
    try {
        while (count == items.length)
            notFull.await();    //可以看到当队列已满时会直接挂起当前线程，在其他线程出队操作时会被唤醒
        enqueue(e);   //直到队列有空位才将线程入队
    } finally {
        lock.unlock();
    }
}
```

```java
private void enqueue(E x) {
    // assert lock.getHoldCount() == 1;
    // assert items[putIndex] == null;
    final Object[] items = this.items;
    items[putIndex] = x;
    if (++putIndex == items.length)
        putIndex = 0;
    count++;
    notEmpty.signal();    //对notEmpty的signal唤醒操作
}
```

接着来看出队操作：

```java
public E poll() {
    final ReentrantLock lock = this.lock;
    lock.lock();    //出队同样进行加锁操作，保证同一时间只能有一个线程执行
    try {
        return (count == 0) ? null : dequeue();   //如果队列不为空则出队，否则返回null
    } finally {
        lock.unlock();
    }
}

public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();    //可以响应中断进行加锁
    try {
        while (count == 0)
            notEmpty.await();    //和入队相反，也是一直等直到队列中有元素之后才可以出队，在入队时会唤醒此线程
        return dequeue();
    } finally {
        lock.unlock();
    }
}
```

```java
private E dequeue() {
    // assert lock.getHoldCount() == 1;
    // assert items[takeIndex] != null;
    final Object[] items = this.items;
    @SuppressWarnings("unchecked")
    E x = (E) items[takeIndex];
    items[takeIndex] = null;
    if (++takeIndex == items.length)
        takeIndex = 0;
    count--;
    if (itrs != null)
        itrs.elementDequeued();
    notFull.signal();    //出队操作会调用notFull的signal方法唤醒被挂起处于等待状态的线程
    return x;
}
```

2、比较特殊的队列SynchronousQueue，它没有任何容量，也就是说正常情况下出队必须和入队操作成对出现，它的内部有一个抽象类Transferer，定义了一个`transfer`方法：

```java
abstract static class Transferer<E> {
    /**
     * 可以是put也可以是take操作
     *
     * @param e 如果不是空，即作为生产者，那么表示会将传入参数元素e交给消费者
     *          如果为空，即作为消费者，那么表示会从生产者那里得到一个元素e并返回
     * @param 是否可以超时
     * @param 超时时间
     * @return 不为空就是从生产者那里返回的，为空表示要么被中断要么超时。
     */
    abstract E transfer(E e, boolean timed, long nanos);
}
```

乍一看，有点迷惑，难不成还要靠这玩意去实现put和take操作吗？实际上它是直接以生产者消费者模式进行的，由于不需要依靠任何容器结构来暂时存放数据，所以我们可以直接通过`transfer`方法来对生产者和消费者之间的数据进行传递。

比如一个线程put一个新的元素进入，这时如果没有其他线程调用take方法获取元素，那么会持续被阻塞，直到有线程取出元素，而`transfer`正是需要等生产者消费者双方都到齐了才能进行交接工作，单独只有其中一方都需要进行等待。

```java
public void put(E e) throws InterruptedException {
    if (e == null) throw new NullPointerException();  //判空
    if (transferer.transfer(e, false, 0) == null) {   //直接使用transfer方法进行数据传递
        Thread.interrupted();    //为空表示要么被中断要么超时
        throw new InterruptedException();
    }
}
```

它在公平和非公平模式下，有两个实现，这里我们来看公平模式下的SynchronousQueue是如何实现的：

```java
static final class TransferQueue<E> extends Transferer<E> {
     //头结点（头结点仅作为头结点，后续节点才是真正等待的线程节点）
     transient volatile QNode head;
     //尾结点
     transient volatile QNode tail;

    /** 节点有生产者和消费者角色之分 */
    static final class QNode {
        volatile QNode next;          // 后继节点
        volatile Object item;         // 存储的元素
        volatile Thread waiter;       // 处于等待的线程，和之前的AQS一样的思路，每个线程等待的时候都会被封装为节点
        final boolean isData;         // 是生产者节点还是消费者节点
```

公平模式下，Transferer的实现是TransferQueue，是以先进先出的规则的进行的，内部有一个QNode类来保存等待的线程。

`transfer()` 方法的实现：

```java
E transfer(E e, boolean timed, long nanos) {   //注意这里面没加锁，肯定会多个线程之间竞争
    QNode s = null;
    boolean isData = (e != null);   //e为空表示消费者，不为空表示生产者

    for (;;) {
        QNode t = tail;
        QNode h = head;
        if (t == null || h == null)         // 头结点尾结点任意为空（但是在构造的时候就已经不是空了）
            continue;                       // 自旋

        if (h == t || t.isData == isData) { // 头结点等于尾结点表示队列中只有一个头结点，肯定是空，或者尾结点角色和当前节点一样，这两种情况下，都需要进行入队操作
            QNode tn = t.next;
            if (t != tail)                  // 如果这段时间内t被其他线程修改了，如果是就进下一轮循环重新来
                continue;
            if (tn != null) {               // 继续校验是否为队尾，如果tn不为null，那肯定是其他线程改了队尾，可以进下一轮循环重新来了
                advanceTail(t, tn);					// CAS将新的队尾节点设置为tn，成不成功都无所谓，反正这一轮肯定没戏了
                continue;
            }
            if (timed && nanos <= 0)        // 超时返回null
                return null;
            if (s == null)
                s = new QNode(e, isData);   //构造当前结点，准备加入等待队列
            if (!t.casNext(null, s))        // CAS添加当前节点为尾结点的下一个，如果失败肯定其他线程又抢先做了，直接进下一轮循环重新来
                continue;

            advanceTail(t, s);              // 上面的操作基本OK了，那么新的队尾元素就修改为s
            Object x = awaitFulfill(s, e, timed, nanos);   //开始等待s所对应的消费者或是生产者进行交接，比如s现在是生产者，那么它就需要等到一个消费者的到来才会继续（这个方法会先进行自旋等待匹配，如果自旋一定次数后还是没有匹配成功，那么就挂起）
            if (x == s) {                   // 如果返回s本身说明等待状态下被取消
                clean(t, s);
                return null;
            }

            if (!s.isOffList()) {           // 如果s操作完成之后没有离开队列，那么这里将其手动丢弃
                advanceHead(t, s);          // 将s设定为新的首节点(注意头节点仅作为头结点，并非处于等待的线程节点)
                if (x != null)              // 删除s内的其他信息
                    s.item = s;
                s.waiter = null;
            }
            return (x != null) ? (E)x : e;   //假如当前是消费者，直接返回x即可，x就是从生产者那里拿来的元素

        } else {                            // 这种情况下就是与队列中结点类型匹配的情况了（注意队列要么为空要么只会存在一种类型的节点，因为一旦出现不同类型的节点马上会被交接掉）
            QNode m = h.next;               // 获取头结点的下一个接口，准备进行交接工作
            if (t != tail || m == null || h != head)
                continue;                   // 判断其他线程是否先修改，如果修改过那么开下一轮

            Object x = m.item;
            if (isData == (x != null) ||    // 判断节点类型，如果是相同的操作，那肯定也是有问题的
                x == m ||                   // 或是当前操作被取消
                !m.casItem(x, e)) {         // 上面都不是？那么最后再进行CAS替换m中的元素，成功表示交接成功，失败就老老实实重开吧
                advanceHead(h, m);          // dequeue and retry
                continue;
            }

            advanceHead(h, m);              // 成功交接，新的头结点可以改为m了，原有的头结点直接不要了
            LockSupport.unpark(m.waiter);   // m中的等待交接的线程可以继续了，已经交接完成
            return (x != null) ? (E)x : e;  // 同上，该返回什么就返回什么
        }
    }
}
```

所以，总结为以下流程：

![image-20230306172203832](/juc-img/Dp7d5X28RK6xrzl.png)

对于非公平模式下的SynchronousQueue，则是采用的栈结构来存储等待节点，但是思路也是与这里的一致，需要等待并进行匹配操作。

在JDK7的时候，基于SynchronousQueue产生了一个更强大的TransferQueue，它保留了SynchronousQueue的匹配交接机制，并且与等待队列进行融合。

3、我们知道，SynchronousQueue并没有使用锁，而是采用CAS操作保证生产者与消费者的协调，但是它没有容量，而LinkedBlockingQueue虽然是有容量且无界的，但是内部基本都是基于锁实现的，性能并不是很好，这时，我们就可以将它们各自的优点单独拿出来，揉在一起，就成了性能更高的LinkedTransferQueue

```java
public static void main(String[] args) throws InterruptedException {
    LinkedTransferQueue<String> queue = new LinkedTransferQueue<>();
    queue.put("1");  //插入时，会先检查是否有其他线程等待获取，如果是，直接进行交接，否则插入到存储队列中
   	queue.put("2");  //不会像SynchronousQueue那样必须等一个匹配的才可以
    queue.forEach(System.out::println);   //直接打印所有的元素，这在SynchronousQueue下只能是空，因为单独的入队或出队操作都会被阻塞
}
```

相比 `SynchronousQueue` ，它多了一个可以存储的队列，我们依然可以像阻塞队列那样获取队列中所有元素的值，简单来说，`LinkedTransferQueue`其实就是一个多了存储队列的`SynchronousQueue`。

接着我们来了解一些其他的队列：

* PriorityBlockingQueue - 是一个支持优先级的阻塞队列，元素的获取顺序按优先级决定。
* DelayQueue - 它能够实现延迟获取元素，同样支持优先级。

我们先来看优先级阻塞队列：

```java
public static void main(String[] args) throws InterruptedException {
    PriorityBlockingQueue<Integer> queue =
            new PriorityBlockingQueue<>(10, Integer::compare);   //可以指定初始容量（可扩容）和优先级比较规则，这里我们使用升序
    queue.add(3);
    queue.add(1);
    queue.add(2);
    System.out.println(queue);    //注意保存顺序并不会按照优先级排列，所以可以看到结果并不是排序后的结果
    System.out.println(queue.poll());   //但是出队顺序一定是按照优先级进行的
    System.out.println(queue.poll());
    System.out.println(queue.poll());
}
```

我们的重点是DelayQueue，它能实现延时出队，也就是说当一个元素插入后，如果没有超过一定时间，那么是无法让此元素出队的。

```java
public class DelayQueue<E extends Delayed> extends AbstractQueue<E>
    implements BlockingQueue<E> {
```

可以看到此类只接受Delayed的实现类作为元素：

```java
public interface Delayed extends Comparable<Delayed> {  //注意这里继承了Comparable，它支持优先级

    //获取剩余等待时间，正数表示还需要进行等待，0或负数表示等待结束
    long getDelay(TimeUnit unit);
}
```

这里我们手动实现一个：

```java
private static class Test implements Delayed {
    private final long time;   //延迟时间，这里以毫秒为单位
    private final int priority;
    private final long startTime;
    private final String data;

    private Test(long time, int priority, String data) {
        this.time = TimeUnit.SECONDS.toMillis(time);   //秒转换为毫秒
        this.priority = priority;
        this.startTime = System.currentTimeMillis();   //这里我们以毫秒为单位
        this.data = data;
    }

    @Override
    public long getDelay(TimeUnit unit) {
        long leftTime = time - (System.currentTimeMillis() - startTime); //计算剩余时间 = 设定时间 - 已度过时间(= 当前时间 - 开始时间)
        return unit.convert(leftTime, TimeUnit.MILLISECONDS);   //注意进行单位转换，单位由队列指定（默认是纳秒单位）
    }

    @Override
    public int compareTo(Delayed o) {
        if(o instanceof Test)
            return priority - ((Test) o).priority;   //优先级越小越优先
        return 0;
    }

    @Override
    public String toString() {
        return data;
    }
}
```

接着我们在主方法中尝试使用：

```java
public static void main(String[] args) throws InterruptedException {
    DelayQueue<Test> queue = new DelayQueue<>();
    queue.add(new Test(1, 2, "2号"));   //1秒钟延时
    queue.add(new Test(3, 1, "1号"));   //1秒钟延时，优先级最高

    System.out.println(queue.take());    //注意出队顺序是依照优先级来的，即使一个元素已经可以出队了，依然需要等待优先级更高的元素到期
    System.out.println(queue.take());
}
```

我们来研究一下DelayQueue是如何实现的，首先来看`add()`方法：

```java
public boolean add(E e) {
    return offer(e);
}

public boolean offer(E e) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        q.offer(e);   //注意这里是向内部维护的一个优先级队列添加元素，并不是DelayQueue本身存储元素
        if (q.peek() == e) {   //如果入队后队首就是当前元素，那么直接进行一次唤醒操作（因为有可能之前就有其他线程等着take了）
            leader = null;
            available.signal();
        }
        return true;
    } finally {
        lock.unlock();
    }
}

public void put(E e) {
    offer(e);
}
```

可以看到无论是哪种入队操作，都会加锁进行，属于常规操作。我们接着来看`take()`方法：

```java
public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;   //出队也要先加锁，基操
    lock.lockInterruptibly();
    try {
        for (;;) {    //无限循环，常规操作
            E first = q.peek();    //获取队首元素
            if (first == null)     //如果为空那肯定队列为空，先等着吧，等有元素进来
                available.await();
            else {
                long delay = first.getDelay(NANOSECONDS);    //获取延迟，这里传入的时间单位是纳秒
                if (delay <= 0)
                    return q.poll();     //如果获取到延迟时间已经小于0了，那说明ok，可以直接出队返回
                first = null;
                if (leader != null)   //这里用leader来减少不必要的等待时间，如果不是null那说明有线程在等待，为null说明没有线程等待
                    available.await();   //如果其他线程已经在等元素了，那么当前线程直接进永久等待状态
                else {
                    Thread thisThread = Thread.currentThread();
                    leader = thisThread;    //没有线程等待就将leader设定为当前线程
                    try {
                        available.awaitNanos(delay);     //获取到的延迟大于0，那么就需要等待延迟时间，再开始下一次获取
                    } finally {
                        if (leader == thisThread)
                            leader = null;
                    }
                }
            }
        }
    } finally {
        if (leader == null && q.peek() != null)
            available.signal();   //当前take结束之后唤醒一个其他永久等待状态下的线程
        lock.unlock();   //解锁，完事
    }
}
```

## 十四、线程池（资源管理核心）

线程池其实是一种池化的技术实现，池化技术的核心思想就是实现资源的复用，避免资源的重复创建和销毁带来的性能开销。线程池可以管理一堆线程，让线程执行完任务之后不进行销毁，而是继续去处理其它线程已经提交的任务。

比如我们的Tomcat服务器，要在同一时间接受和处理大量的请求，那么就必须要在短时间内创建大量的线程，结束后又进行销毁，这显然会导致很大的开销，因此这种情况下使用线程池显然是更好的解决方案。

由于线程池可以反复利用已有线程执行多线程操作，所以它一般是有容量限制的，当所有的线程都处于工作状态时，那么新的多线程请求会被阻塞，直到有一个线程空闲出来为止，实际上这里就会用到我们之前讲解的阻塞队列。

使用线程池的好处：

- 降低资源消耗。通过重复利用已创建的线程降低线程创建和销毁造成的消耗。
- 提高响应速度。当任务到达时，任务可以不需要等到线程创建就能立即执行。
- 提高线程的可管理性。线程是稀缺资源，如果无限制的创建，不仅会消耗系统资源，还会降低系统的稳定性，使用线程池可以进行统一的分配，调优和监控。

![image-20230306172249412](/juc-img/ogcqAkahnWYByE2.png)

### 线程池相关类和接口

**1、顶层接口：**`Executor`

```java
public interface Executor {
    void execute(Runnable command);
}
```

**2、核心接口：**`ExecutorService`**（继承** `Executor`**）**

```java
public interface ExecutorService extends Executor {
    // 提交任务（支持返回值）
    <T> Future<T> submit(Callable<T> task);
    Future<?> submit(Runnable task);

    // 批量提交
    <T> List<Future<T>> invokeAll(Collection<? extends Callable<T>> tasks);

    // 关闭控制
    void shutdown();
    List<Runnable> shutdownNow();
    boolean isShutdown();
    boolean isTerminated();
    boolean awaitTermination(long timeout, TimeUnit unit);
}
```

* 支持 `Callable`（有返回值/异常）；

- 支持批量任务；
- 支持优雅关闭（`shutdown()` / `shutdownNow()`）。

> **所有线程池实现都实现此接口**。

**3、核心抽象类：**`AbstractExecutorService`

```java
public abstract class AbstractExecutorService 
    implements ExecutorService {
    
    // 提供 submit/invokeAll 等方法的默认实现
    public Future<?> submit(Runnable task) {
        if (task == null) throw new NullPointerException();
        RunnableFuture<Void> ftask = newTaskFor(task, null);
        execute(ftask); // ← 调用子类实现的 execute()
        return ftask;
    }
    
    protected <T> RunnableFuture<T> newTaskFor(Callable<T> callable) {
        return new FutureTask<T>(callable);
    }
}
```

- **定位**：**为具体线程池实现提供通用骨架**。
- **作用**：
  - 将 `submit()`、`invokeAll()` 等高级操作**统一转为 `execute(RunnableFuture)`**；
  - 子类只需实现 `execute()` 和生命周期方法即可。
- **典型子类**：`ThreadPoolExecutor`, `ForkJoinPool`

> **模板方法模式**的经典应用！

**4、核心实现类：**`ThreadPoolExecutor`

```java
public class ThreadPoolExecutor 
    extends AbstractExecutorService {
    
    // 核心方法：由 AbstractExecutorService 调用
    public void execute(Runnable command) { /* ... */ }
    
    // 生命周期方法
    public void shutdown() { /* ... */ }
    public List<Runnable> shutdownNow() { /* ... */ }
}
```

- **定位**：**标准线程池实现**（基于“池化线程 + 任务队列”模型）。
- **核心机制**：
  - 线程复用（避免频繁创建/销毁）；
  - 任务队列缓冲（`BlockingQueue`）；
  - 拒绝策略（`RejectedExecutionHandler`）；
  - 可配置核心/最大线程数、存活时间等。

**5、特殊线程池：**`ScheduledThreadPoolExecutor`

```java
public class ScheduledThreadPoolExecutor
    extends ThreadPoolExecutor
    implements ScheduledExecutorService {
    
    public ScheduledFuture<?> schedule(Runnable command, long delay, TimeUnit unit);
    public ScheduledFuture<?> scheduleAtFixedRate(Runnable command, ...);
}
```

- **定位**：**支持延迟执行和周期性任务的线程池**。
- **底层**：使用 `DelayedWorkQueue`（内部优先队列）管理定时任务。

**6、调度接口：**`ScheduledExecutorService`

```java
public interface ScheduledExecutorService extends ExecutorService {
    // 延迟执行
    ScheduledFuture<?> schedule(Runnable command, long delay, TimeUnit unit);
    
    // 固定频率执行（以上次开始时间为基准）
    ScheduledFuture<?> scheduleAtFixedRate(Runnable command, ...);
    
    // 固定延迟执行（以上次结束时间为基准）
    ScheduledFuture<?> scheduleWithFixedDelay(Runnable command, ...);
}
```

- **定位**：`ExecutorService` 的**定时任务扩展**。
- **唯一实现**：`ScheduledThreadPoolExecutor`

**7、工具类：**`Executors`（谨慎使用）

```java
public class Executors {
    // 固定线程数量的线程池：核心线程数与最大线程数相等
    public static ExecutorService newFixedThreadPool(int nThreads) {
        return new ThreadPoolExecutor(nThreads, nThreads,
                                      0L, TimeUnit.MILLISECONDS,
                                      new LinkedBlockingQueue<Runnable>());
    }
  
    // 单个线程数量的线程池
    public static ExecutorService newSingleThreadExecutor() {
        return new FinalizableDelegatedExecutorService
            (new ThreadPoolExecutor(1, 1,
                                    0L, TimeUnit.MILLISECONDS,
                                    new LinkedBlockingQueue<Runnable>()));
    }
  
    // 接近无限大线程数量的线程池
    public static ExecutorService newCachedThreadPool() {
        return new ThreadPoolExecutor(0, Integer.MAX_VALUE,
                                      60L, TimeUnit.SECONDS,
                                      new SynchronousQueue<Runnable>());
    }
  
    // 带定时调度功能的线程池
    public static ScheduledExecutorService newScheduledThreadPool(int corePoolSize) {
        return new ScheduledThreadPoolExecutor(corePoolSize);
    }
```

- **定位**：**线程池工厂**（提供便捷创建方法）。
- **⚠️ 严重问题**：
  - `newFixedThreadPool` / `newSingleThreadExecutor`：使用**无界队列**（`LinkedBlockingQueue`）→ **可能 OOM 内存溢出**；
  - `newCachedThreadPool`：**最大线程数为 Integer.MAX_VALUE** → **可能创建过多线程导致系统崩溃**。

> [!IMPORTANT]
>
> **阿里《Java开发手册》明确建议**：
> **禁止使用 `Executors` 创建线程池，应通过 `new ThreadPoolExecutor` 显式指定参数。**

### 线程池ThreadPoolExecutor的构建和使用

Java 主要是通过构建 ThreadPoolExecutor 来创建线程池的。接下来看一下线程池是如何构造出来的：

```java
public ThreadPoolExecutor(int corePoolSize,
                          int maximumPoolSize,
                          long keepAliveTime,
                          TimeUnit unit,
                          BlockingQueue<Runnable> workQueue,
                          ThreadFactory threadFactory,
                          RejectedExecutionHandler handler) {
    if (corePoolSize < 0 ||
        maximumPoolSize <= 0 ||
        maximumPoolSize < corePoolSize ||
        keepAliveTime < 0)
        throw new IllegalArgumentException();
    if (workQueue == null || threadFactory == null || handler == null)
        throw new NullPointerException();
    this.acc = System.getSecurityManager() == null ?
            null :
            AccessController.getContext();
    this.corePoolSize = corePoolSize;
    this.maximumPoolSize = maximumPoolSize;
    this.workQueue = workQueue;
    this.keepAliveTime = unit.toNanos(keepAliveTime);
    this.threadFactory = threadFactory;
    this.handler = handler;
}
```

包含参数如下：

* corePoolSize：**核心线程池大小**，我们每向线程池提交一个多线程任务时，都会创建一个新的`核心线程`，无论是否存在其他空闲线程，直到到达核心线程池大小为止，之后会尝试复用线程资源。当然也可以在一开始就全部初始化好，调用` prestartAllCoreThreads()`即可。

  ![img](/juc-img/e0c4439a8b212116ed3de762f8a945ae.png)

* maximumPoolSize：**最大线程池大小**，当目前线程池中所有的线程都处于运行状态，并且等待队列已满，那么就会直接尝试继续创建新的`非核心线程`运行，但是不能超过最大线程池大小。

* keepAliveTime：**线程最大空闲时间**，当一个`非核心线程`空闲超过一定时间，会自动销毁。

* unit：**线程最大空闲时间的时间单位**

* workQueue：**任务队列**，是一个阻塞队列，当线程数达到核心线程数后，会将任务存储在阻塞队列中。

* threadFactory：**线程池内部创建线程所用的工厂**，我们可以干涉线程池中线程的创建过程，进行自定义。

* handler：**拒绝策略**，当队列已满并且线程数量达到最大线程数量时，会调用该方法处理任务。

1、最为重要的就是**核心线程池大小的限定**，根据**线程池执行任务的特性**合理地分配大小会使得线程池的执行效率事半功倍：

* **CPU密集型：** 线程几乎一直在使用 CPU（如矩阵计算、加密解密）。

  如果线程数 > CPU核心数：

  - 多余的线程无法真正并行，只能通过**时间片轮转**交替执行；
  - 频繁的**上下文切换**（保存/恢复寄存器、缓存失效）会**降低整体吞吐量**。

  因此，**最优线程数 ≈ CPU核心数**（或略高，如 `核心数 + 1` 容错）。

  > [!NOTE]
  >
  > 注意：这里指的是**物理核心数**（不是逻辑处理器数）。
  > 例如 i5-9400F 是 **6核6线程**（无超线程），所以是 6；
  > 而 i7-10700K 是 **8核16线程**（有超线程），通常仍按 **8** 计算（因为超线程共享ALU等资源）。

* **IO密集型**： 主要是进行 IO 操作，CPU需要等着待IO操作，很容易出现空闲状态，导致 CPU 的利用率不高，这种情况下可以适当增加线程池的大小，让更多的线程可以一起进行IO操作，一般可以配置为CPU核心数的2倍（适合轻度 IO 密集型如本地文件读写、快速网络请求，等待时间 / 计算时间 ≈ 1，但它不适用于重度 IO 场景如远程数据库、慢速网络）。

  更科学的公式（来自《Java Concurrency in Practice》）：

  <img src="/juc-img/image-20260117195043494.png" alt="image-20260117195043494" style="zoom:50%;" />

  > [!IMPORTANT]
  >
  > Java 中用来获取 CPU 核心数的方法是：`Runtime.getRuntime().availableProcessors();`

2、阻塞队列**优先选择有界队列 + 合理的 maxPoolSize**，比如 LinkedBlockingQueue 在构造的时候可以传入参数来限制队列中任务数据的大小，避免使用无界队列如LinkedBlockingQueue默认构造导致无限往队列中扔任务而oom。

使用SynchronousQueue则队列永远不会缓存任务，线程数快速膨胀到 maximumPoolSize，如果任务处理慢，会导致**大量线程被创建**，可能耗尽 CPU/内存。

```java
public static void main(String[] args) throws InterruptedException {
    ThreadPoolExecutor executor =
            new ThreadPoolExecutor(2, 4,   //2个核心线程，最大线程数为4个
                    3, TimeUnit.SECONDS,        //最大空闲时间为3秒钟
                    new ArrayBlockingQueue<>(2));     //这里使用容量为2的ArrayBlockingQueue队列

    for (int i = 0; i < 6; i++) {   //开始6个任务
        int finalI = i;
        executor.execute(() -> {
            try {
                System.out.println(Thread.currentThread().getName()+" 开始执行！（"+ finalI);
                TimeUnit.SECONDS.sleep(1);
                System.out.println(Thread.currentThread().getName()+" 已结束！（"+finalI);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        });
    }

    TimeUnit.SECONDS.sleep(1);    //看看当前线程池中的线程数量
    System.out.println("线程池中线程数量："+executor.getPoolSize());
    TimeUnit.SECONDS.sleep(5);     //等到超过空闲时间
    System.out.println("线程池中线程数量："+executor.getPoolSize());

    executor.shutdownNow();    //使用完线程池记得关闭，不然程序不会结束，它会取消所有等待中的任务以及试图中断正在执行的任务，关闭后，无法再提交任务，一律拒绝
  	//executor.shutdown();     同样可以关闭，但是会执行完等待队列中的任务再关闭
}
```

要是等待队列设定为没有容量的SynchronousQueue呢，这个时候会发生什么？

```java
pool-1-thread-1 开始执行！（0
pool-1-thread-4 开始执行！（3
pool-1-thread-3 开始执行！（2
pool-1-thread-2 开始执行！（1
Exception in thread "main" java.util.concurrent.RejectedExecutionException: Task com.test.Main$$Lambda$1/1283928880@682a0b20 rejected from java.util.concurrent.ThreadPoolExecutor@3d075dc0[Running, pool size = 4, active threads = 4, queued tasks = 0, completed tasks = 0]
	at java.util.concurrent.ThreadPoolExecutor$AbortPolicy.rejectedExecution(ThreadPoolExecutor.java:2063)
	at java.util.concurrent.ThreadPoolExecutor.reject(ThreadPoolExecutor.java:830)
	at java.util.concurrent.ThreadPoolExecutor.execute(ThreadPoolExecutor.java:1379)
	at com.test.Main.main(Main.java:15)
```

可以看到，前4个任务都可以正常执行，但是到第五个任务时，直接抛出了异常，这其实就是因为等待队列的容量为0，相当于没有容量，那么这个时候，就只能拒绝任务了，拒绝的操作会根据拒绝策略决定。

3、JDK 线程池自带的 RejectedExecutionHandler 拒绝策略实现有 4 种：

* **AbortPolicy（默认）**：丢弃任务，抛出运行时异常。
* **CallerRunsPolicy**：直接让提交任务的线程执行这个任务，比如在主线程向线程池提交了任务，那么就直接由主线程执行。
* **DiscardOldestPolicy**：丢弃队列中最先进入队列的一个任务，然后再次提交任务。
* **DiscardPolicy**：丢弃这个任务，但是不抛异常。

进行一下测试：

```java
public static void main(String[] args) throws InterruptedException {
    ThreadPoolExecutor executor =
            new ThreadPoolExecutor(2, 4,
                    3, TimeUnit.SECONDS,
                    new SynchronousQueue<>(),
                    new ThreadPoolExecutor.CallerRunsPolicy());
```

```java
pool-1-thread-1 开始执行！（0
pool-1-thread-2 开始执行！（1
main 开始执行！（4
pool-1-thread-4 开始执行！（3
pool-1-thread-3 开始执行！（2
pool-1-thread-3 已结束！（2
pool-1-thread-2 已结束！（1
pool-1-thread-1 已结束！（0
main 已结束！（4
pool-1-thread-4 已结束！（3
pool-1-thread-1 开始执行！（5
pool-1-thread-1 已结束！（5
线程池中线程数量：4
线程池中线程数量：2
```

```java
public static void main(String[] args) throws InterruptedException {
    ThreadPoolExecutor executor =
            new ThreadPoolExecutor(2, 4,
                    3, TimeUnit.SECONDS,
                    new ArrayBlockingQueue<>(1),    //这里设置为ArrayBlockingQueue，长度为1
                    new ThreadPoolExecutor.DiscardOldestPolicy());   
```

它会移除等待队列中的最近的一个任务2，可以看到任务2实际上是被任务5替代了：

```bash
pool-1-thread-1 开始执行！（0
pool-1-thread-4 开始执行！（4
pool-1-thread-3 开始执行！（3
pool-1-thread-2 开始执行！（1
pool-1-thread-1 已结束！（0
pool-1-thread-4 已结束！（4
pool-1-thread-1 开始执行！（5
线程池中线程数量：4
pool-1-thread-3 已结束！（3
pool-1-thread-2 已结束！（1
pool-1-thread-1 已结束！（5
线程池中线程数量：2
```

这里如果选择没有容量的SynchronousQueue作为等待队列会爆栈：

```java
pool-1-thread-1 开始执行！（0
pool-1-thread-3 开始执行！（2
pool-1-thread-2 开始执行！（1
pool-1-thread-4 开始执行！（3
Exception in thread "main" java.lang.StackOverflowError
	at java.util.concurrent.SynchronousQueue.offer(SynchronousQueue.java:912)
	at java.util.concurrent.ThreadPoolExecutor.execute(ThreadPoolExecutor.java:1371)	
	...
pool-1-thread-1 已结束！（0
pool-1-thread-2 已结束！（1
pool-1-thread-4 已结束！（3
pool-1-thread-3 已结束！（2
```

这是为什么呢？看看这个拒绝策略的源码：

```java
public static class DiscardOldestPolicy implements RejectedExecutionHandler {
    public DiscardOldestPolicy() { }

    public void rejectedExecution(Runnable r, ThreadPoolExecutor e) {
        if (!e.isShutdown()) {
            e.getQueue().poll();   //会先执行一次出队操作，但是这对于SynchronousQueue来说毫无意义
            e.execute(r);     //这里会再次调用execute方法
        }
    }
}
```

可以看到，它会先对等待队列进行出队操作，但是由于SynchronousQueue压根没容量，所有这个操作毫无意义，然后就会递归执行`execute`方法，而进入之后，又发现没有容量不能插入，于是又重复上面的操作，这样就会无限的递归下去，最后爆栈。

4、线程创建工厂默认使用 **`Executors.defaultThreadFactory()`**

推荐手动创建线程创建工厂 ThreadFactory：

| 需求               | 自定义方式                                                   |
| ------------------ | ------------------------------------------------------------ |
| 有意义的线程名     | 便于日志排查和监控（如 `"order-service-pool-thread-1"`）     |
| 设置为守护线程     | 避免线程池阻止 JVM 退出（适用于后台任务）                    |
| 设置异常处理器     | 捕获线程内未处理的异常                                       |
| 设置上下文类加载器 | 在复杂类加载环境（如 Web 容器）中避免 `ClassNotFoundException` |

（1）通用工厂（带命名、异常处理）

```java
/**
 * 自定义线程工厂，用于为线程池中的线程生成具有业务意义的名称。
 * 
 * 作用：
 * - 便于日志追踪、线程 dump 分析和监控系统识别；
 * - 避免使用默认的 "pool-N-thread-M" 这类无意义名称；
 * - 支持统一设置线程属性（如守护状态、优先级、异常处理器等）。
 */
public class NamedThreadFactory implements ThreadFactory {
    
    /** 线程名称前缀，用于标识线程池所属的业务模块 */
    private final String namePrefix;
    
    /** 原子计数器，确保线程编号在该工厂内唯一且递增 */
    private final AtomicInteger threadNumber = new AtomicInteger(1);

    /**
     * 构造函数
     * @param namePrefix 线程名前缀，建议使用有意义的业务标识，如 "order-service", "file-processor"
     */
    public NamedThreadFactory(String namePrefix) {
        // 防止传入 null 导致线程名异常
        this.namePrefix = Objects.requireNonNull(namePrefix, "namePrefix must not be null");
    }

    /**
     * 创建新线程
     * 
     * 注意：此方法由线程池在需要新建工作线程时调用。
     * 
     * @param r 要在线程中执行的任务（Runnable）
     * @return 配置好的 Thread 实例
     */
    @Override
    public Thread newThread(Runnable r) {
        // 构造线程名：例如 "my-app-thread-1", "my-app-thread-2", ...
        String threadName = namePrefix + "-thread-" + threadNumber.getAndIncrement();
        
        Thread t = new Thread(
            null,           // 不指定父线程组（使用当前线程的线程组）
            r,              // 任务逻辑
            threadName,     // 自定义线程名（关键！）
            0               // 栈大小（0 表示使用 JVM 默认值）
        );
        
        // 设置为非守护线程（默认行为）：
        // 守护线程会在主线程退出时被强制终止，通常工作线程应为非守护线程，
        // 以确保任务能正常完成，避免 JVM 提前退出。
        t.setDaemon(false);
        
        // 设置标准优先级（5），避免因优先级过高/过低影响系统整体调度
        t.setPriority(Thread.NORM_PRIORITY);
        
        // 可在此处添加未捕获异常处理器，用于记录或上报异常
        t.setUncaughtExceptionHandler((thread, ex) -> {
            System.err.println("线程 " + thread.getName() + " 发生异常: " + ex);
        });
        
        return t;
    }
}
```

```java
// 创建一个固定大小的线程池（核心线程数 = 最大线程数 = 4）
// 适用于 CPU 密集型或稳定负载的场景
ExecutorService executor = new ThreadPoolExecutor(
    4,4,0L,TimeUnit.MILLISECONDS,
    new LinkedBlockingQueue<>(),  // 无界任务队列（⚠️ 注意：可能 OOM，生产建议用有界队列）
    new NamedThreadFactory("my-app") // ← 使用自定义线程工厂，线程名如 "my-app-thread-1"
);
```

（2）如果你使用 Guava，可以用 `ThreadFactoryBuilder` 更简洁地构建：

```java
ThreadFactory factory = new ThreadFactoryBuilder()
    .setNameFormat("my-pool-%d")
    .setDaemon(true)
    .setUncaughtExceptionHandler((t, e) -> log.error("Uncaught exception", e))
    .build();
```

```java
public static void main(String[] args) throws InterruptedException {
    ThreadPoolExecutor executor =
            new ThreadPoolExecutor(2, 4,
                    3, TimeUnit.SECONDS,
                    new SynchronousQueue<>(),
                    new ThreadFactory() {
                        int counter = 0;
                        @Override
                        public Thread newThread(Runnable r) {
                            return new Thread(r, "我的自定义线程-"+counter++);
                        }
                    });

    for (int i = 0; i < 4; i++) {
        executor.execute(() -> System.out.println(Thread.currentThread().getName()+" 开始执行！"));
    }
}
```

> [!NOTE]
>
> 如果我们的任务在运行过程中出现异常了，那么是不是会导致线程池中的线程被销毁呢？

```java
public static void main(String[] args) throws InterruptedException {
    ThreadPoolExecutor executor = new ThreadPoolExecutor(1, 1,   //最大容量和核心容量锁定为1
            0, TimeUnit.MILLISECONDS, new LinkedBlockingDeque<>());
    executor.execute(() -> {
        System.out.println(Thread.currentThread().getName());
        throw new RuntimeException("我是异常！");
    });
    TimeUnit.SECONDS.sleep(1);
    executor.execute(() -> {
        System.out.println(Thread.currentThread().getName());
    });
}
```

可以看到，出现异常之后，再次提交新的任务，执行的线程是一个新的线程了。

### 线程池的监控

在项目中使用线程池的时候，一般需要对线程池进行监控，方便出问题的时候快速定位。线程池本身提供了一些方法来获取线程池的运行状态。

- getCompletedTaskCount：已经执行完成的任务数量
- getLargestPoolSize：线程池里曾经创建过的最大的线程数量。这个主要是用来判断线程是否满过。
- getActiveCount：获取正在执行任务的线程数据
- getPoolSize：获取当前线程池中线程数量的大小

除了线程池提供的上述已经实现的方法，同时线程池也预留了很多扩展方法。比如在 runWorker 方法里面，执行任务之前会回调 beforeExecute 方法，执行任务之后会回调 afterExecute 方法，而这些方法默认都是空实现，小伙伴们可以自己继承 ThreadPoolExecutor 来重写这些方法，实现自己想要的功能。

### 线程池实现原理

#### 线程池的五种状态

Java 线程池通过一个 `ctl` 变量（高3位表示状态，低29位表示线程数）管理生命周期，状态按顺序演进：

```
RUNNING  →  SHUTDOWN  →  STOP  →  TIDYING  →  TERMINATED
```

```java
// 1、ctl变量用到了原子类AtomicInteger，用于同时保存线程池运行状态和线程数量
// 它是通过拆分32个bit位来保存数据的，前3位保存状态，后29位保存工作线程数量
private final AtomicInteger ctl = new AtomicInteger(ctlOf(RUNNING, 0));
private static final int COUNT_BITS = Integer.SIZE - 3;    //29位，线程数量位
private static final int CAPACITY   = (1 << COUNT_BITS) - 1;   //计算得出最大容量（1左移29位，最大容量为2的29次方-1）

// 2、线程池内部5个常量来代表线程池的五种状态，注意都是只占用前3位，不会占用后29位
// 线程池创建时就是这个状态，接受新任务，处理队列中任务
private static final int RUNNING    = -1 << COUNT_BITS;   //111 | 0000... (后29数量位，下同)
// 调用 shutdown 方法，不接受新任务，但继续处理队列中已有任务
private static final int SHUTDOWN   =  0 << COUNT_BITS;   //000 | 数量位
// 调用 shutdownNow 方法，不接受新任务，不处理队列任务，清空队列并返回未执行的任务列表，中断所有工作线程
private static final int STOP       =  1 << COUNT_BITS;   //001 | 数量位
// 当线程池满足以下两个条件时，会从 SHUTDOWN 或 STOP 进入 TIDYING，即将执行 terminated() 钩子方法：
// 1、线程池中已无任何工作线程（workerCount == 0）
// 2、任务队列为空（workQueue.isEmpty()）
private static final int TIDYING    =  2 << COUNT_BITS;   //010 | 数量位
// terminated() 执行完毕，线程池完全终止
private static final int TERMINATED =  3 << COUNT_BITS;   //011 | 数量位

// 3、封装和解析ctl变量的一些方法
private static int runStateOf(int c)     { return c & ~CAPACITY; }   //对CAPACITY取反就是后29位全部为0，前三位全部为1，接着与c进行与运算，这样就可以只得到前三位的结果了，所以这里是取运行状态
private static int workerCountOf(int c)  { return c & CAPACITY; }
//同上，这里是为了得到后29位的结果，所以这里是取线程数量
private static int ctlOf(int rs, int wc) { return rs | wc; }   
// 比如上面的RUNNING, 0，进行与运算之后：
// 111 | 0000000000000000000000000
```

![131e1c88a515e066c2e08bd5c6e61ce4](/juc-img/131e1c88a515e066c2e08bd5c6e61ce4.png)

#### 线程池的运行原理

```java
//指定的阻塞队列
private final BlockingQueue<Runnable> workQueue;

public void execute(Runnable command) {
    // 首先检查提交的任务是否为null，是的话则抛出NullPointerException。
    if (command == null)
        throw new NullPointerException();

    // 获取线程池的当前状态（ctl是一个AtomicInteger，其中包含了线程池状态和工作线程数）
    int c = ctl.get();

    // 1. 检查当前运行的工作线程数是否少于核心线程数（corePoolSize）
    if (workerCountOf(c) < corePoolSize) {
        // 如果少于核心线程数，尝试添加一个新的工作线程来执行提交的任务
        // addWorker方法会检查线程池状态和工作线程数，并决定是否真的添加新线程
        if (addWorker(command, true))
            return;
        // 重新获取线程池的状态，因为在尝试添加线程的过程中线程池的状态可能已经发生变化
        c = ctl.get();
    }

    // 2. 尝试将任务添加到任务队列中
    if (isRunning(c) && workQueue.offer(command)) {
        int recheck = ctl.get();
        // 双重检查线程池的状态
        if (! isRunning(recheck) && remove(command))  // 如果线程池已经停止，从队列中移除任务
            reject(command);
        // 如果线程池正在运行，但是工作线程数为0，尝试添加一个新的工作线程
        else if (workerCountOf(recheck) == 0)
            addWorker(null, false);
    }
    // 3. 如果任务队列满了，尝试添加一个新的非核心工作线程来执行任务
    else if (!addWorker(command, false))
        // 如果无法添加新的工作线程（可能因为线程池已经停止或者达到最大线程数限制），则拒绝任务
        reject(command);
}
```

在调用 `execute` 方法之后，线程池会做些什么：

首先会去判断当前线程池的线程数是否小于核心线程数，也就是线程池构造时传入的参数 corePoolSize。

如果小于，那么就直接通过 ThreadFactory 创建一个线程来执行这个任务，如图

![img](/juc-img/42addd79845c52d724b53a09ab795e36.png)

当任务执行完之后，线程不会退出，而是会去阻塞队列中获取任务，如下图

![img](/juc-img/eb88bbf1a27c1ea4a007fb57f3e30c7d.png)

接下来如果又提交了一个任务，也会按照上述的步骤去判断是否小于核心线程数，如果小于，还是会创建线程来执行任务，执行完之后也会从阻塞队列中获取任务。

这里有个细节，就是提交任务的时候，就算有线程池里的线程从阻塞队列中获取不到任务，如果线程池里的线程数还是小于核心线程数，那么依然会继续创建线程，而不是复用已有的线程。

如果线程池里的线程数不再小于核心线程数呢？那么此时就会尝试将任务放入阻塞队列中，入队成功之后，如图

![img](/juc-img/431710628001a446dae2581518460d11.png)

这样，阻塞的线程就可以获取到任务了。

但是，随着任务越来越多，队列已经满了，任务放入失败，怎么办呢？

此时会判断当前线程池里的线程数是否小于最大线程数，也就是入参时的 maximumPoolSize 参数

如果小于最大线程数，那么也会创建非核心线程来执行提交的任务，如图

![img](/juc-img/69ada97f32215011463ee23b8fc6d5c7.png)

所以，就算队列中有任务，新创建的线程还是会优先处理这个提交的任务，而不是从队列中获取已有的任务执行，**从这可以看出，先提交的任务不一定先执行**。

假如线程数已经达到最大线程数量，怎么办呢？

此时就会执行拒绝策略，也就是构造线程池的时候，传入的 RejectedExecutionHandler 对象，来处理这个任务。

![img](/juc-img/c94f1b6f42ebd3a33ca5b7404eb02dc5.jpg)

#### 线程实现复用的原理

**线程执行完任务后不会销毁，而是循环从阻塞队列中获取新任务。这个逻辑在 `Worker` 内部的 `run()` 方法中（具体是 `runWorker()`）。**

1、**Worker 类**继承自 AbstractQueuedSynchronizer，它本身就是一把锁：

```java
private final class Worker
    extends AbstractQueuedSynchronizer
    implements Runnable {
    //工作线程
    final Thread thread;
    //执行的第一个任务
    Runnable firstTask;
    //线程完成了多少个任务
    volatile long completedTasks;

    Worker(Runnable firstTask) {
        setState(-1); // 执行Task之前不让中断，将AQS的state设定为-1
        this.firstTask = firstTask;
        this.thread = getThreadFactory().newThread(this);   //通过预定义或是我们自定义的线程工厂创建线程
    }
  
    public void run() {
        runWorker(this); // ← 核心任务循环在这里！
    }

   	//0就是没加锁，1就是已加锁
    protected boolean isHeldExclusively() {
        return getState() != 0;
    }

    ...
}
```

2、**核心方法：`runWorker(Worker w)`**

```java
final void runWorker(Worker w) {
    Thread wt = Thread.currentThread();
    Runnable task = w.firstTask; // 先执行构造时传入的任务
    w.firstTask = null;

    boolean completedAbruptly = true;
    try {
        // 🔁 核心循环：只要能拿到任务，就一直执行！
        while (task != null || (task = getTask()) != null) {
            w.lock(); // 获取 Worker 锁（用于中断控制）
            try {
                // 执行任务（可能抛异常）
                task.run();
            } finally {
                w.unlock();
            }
            task = null; // 任务执行完，置空，下一轮从队列取
        }
        completedAbruptly = false;
    } finally {
        // 线程退出前清理（如统计、移除 Worker）
        processWorkerExit(w, completedAbruptly);
    }
}
```

每个工作线程运行在while循环中，由 `getTask()` 从 `workQueue`（阻塞队列）中获取任务，**可能阻塞**，只要 `getTask()` 能返回任务，线程就**不会退出**；

当线程池处于 `SHUTDOWN` 状态且任务队列为空时，`getTask()` 会返回 `null`。工作线程于是跳出循环，进入 `processWorkerExit()`。

3、**`getTask()`：如何从阻塞队列取任务？**

```java
/**
 * 从工作队列中获取下一个要执行的任务。
 * 
 * 此方法由工作线程在 runWorker() 的循环中调用。
 * 它决定了线程是：
 *   - 阻塞等待新任务（复用），
 *   - 超时后退出（回收空闲线程），
 *   - 还是因线程池关闭而终止。
 * 
 * @return 下一个任务，若应终止则返回 null
 */
private Runnable getTask() {
    // 标记上一次 poll() 是否因超时而未取到任务
    boolean timedOut = false;

    // 无限循环，直到成功取到任务或确定应退出
    for (;;) {
        // 获取当前 ctl 值（包含运行状态 + 工作线程数）
        int c = ctl.get();
        int rs = runStateOf(c); // 提取运行状态（RUNNING/SHUTDOWN/STOP...）

        /*
         * 🚦【条件1：线程池已关闭且无需再处理任务】
         * 满足以下任一，说明线程池正在终止，当前线程应退出：
         *   - 状态 >= STOP：不处理队列任务，直接退出；
         *   - 状态 == SHUTDOWN 且 队列为空：优雅关闭已完成。
         */
        if (rs >= SHUTDOWN && (rs >= STOP || workQueue.isEmpty())) {
            // 原子减少工作线程计数
            decrementWorkerCount();
            return null; // 返回 null → runWorker() 退出循环 → 线程终止
        }

        // 当前工作线程数量
        int wc = workerCountOf(c);

        /*
         * 🔥【是否启用超时机制？】
         * - 如果 allowCoreThreadTimeOut = true：所有线程都可超时；
         * - 否则：仅当线程数 > corePoolSize（即“非核心线程”）才超时。
         */
        boolean timed = allowCoreThreadTimeOut || wc > corePoolSize;

        /*
         * 🧯【条件2：当前线程应被回收】
         * 满足以下所有条件时，尝试让当前线程退出：
         *   (a) 线程数超过最大限制（一般不会发生，用于容错）
         *       OR
         *       (timed 为 true 且 上次 poll 已超时)
         *   (b) 并且（线程数 > 1 或 队列为空）→ 至少保留一个线程处理剩余任务
         */
        if ((wc > maximumPoolSize || (timed && timedOut))
            && (wc > 1 || workQueue.isEmpty())) {
            
            // 尝试原子减少线程计数
            if (compareAndDecrementWorkerCount(c)) {
                return null; // 成功减计数 → 当前线程退出
            }
            // 如果 CAS 失败（其他线程也在退出），重试循环
            continue;
        }

        /*
         * 📥【尝试从阻塞队列取任务】
         * - 如果 timed = true：使用 poll(timeout)，超时返回 null；
         * - 否则：使用 take()，永久阻塞直到有任务。
         */
        try {
            Runnable r = timed ?
                workQueue.poll(keepAliveTime, TimeUnit.NANOSECONDS) :
                workQueue.take(); // 阻塞式获取

            if (r != null) {
                return r; // 成功取到任务，交给 runWorker 执行
            }

            // poll 超时未取到任务
            timedOut = true;
        } catch (InterruptedException retry) {
            // 被中断（如 shutdownNow() 触发 interrupt）
            timedOut = false; // 重置超时标志，下轮继续尝试
            // 注意：不抛出异常，而是重试（符合“协作式中断”设计）
        }
    }
}
```

#### 线程池的关闭

线程池提供了 shutdown 和 shutdownNow 两个方法来关闭线程池。

1、shutdown

```java
/**
 * 启动一次顺序关闭，在这次关闭中，执行器不再接受新任务，但会继续处理队列中的已存在任务。
 * 当所有任务都完成后，线程池中的线程会逐渐退出。
 */
public void shutdown() {
    final ReentrantLock mainLock = this.mainLock; // ThreadPoolExecutor的主锁
    mainLock.lock(); // 加锁以确保独占访问

    try {
        checkShutdownAccess(); // 检查是否有关闭的权限
        advanceRunState(SHUTDOWN); // 将执行器的状态更新为SHUTDOWN
        interruptIdleWorkers(); // 中断所有闲置的工作线程
        onShutdown(); // ScheduledThreadPoolExecutor中的挂钩方法，可供子类重写以进行额外操作
    } finally {
        mainLock.unlock(); // 无论try块如何退出都要释放锁
    }

    tryTerminate(); // 如果条件允许，尝试终止执行器
}
```

> `mainLock` **是什么？**
>
> 在 `ThreadPoolExecutor` 中：
>
> ```java
> private final ReentrantLock mainLock = new ReentrantLock();
> ```
>
> - 这是一个**可重入互斥锁**；
> - 用于保护**所有对线程池内部共享状态的修改操作**，包括：
>   - 线程池运行状态（`runState`）
>   - 工作线程集合（`workers`：`HashSet<Worker>`）
>   - 大型任务队列的某些操作（如 `drainQueue()`）
>   - 生命周期方法（`shutdown()`, `shutdownNow()`）
>
> **设计原则**：**“任何修改线程池核心状态的操作，都必须持有 `mainLock`。”**

`tryTerminate()` 检测到 `workerCount > 0`，会直接返回，此时线程池尚未终止。由于每个工作线程运行在一个主循环中，当线程池处于 `SHUTDOWN` 状态且任务队列为空时，会跳出循环，在 `processWorkerExit` 方法中**主动调用 `tryTerminate()` 来尝试推进终止。**

因此，线程池的关闭不是靠 `shutdown()` 一次性完成的，而是**分布式、协作式**的。

```java
ExecutorService pool = Executors.newFixedThreadPool(2);
pool.execute(() -> { /* 任务1 */ });
pool.execute(() -> { /* 任务2 */ });

pool.shutdown(); // 进入 SHUTDOWN
// 此时任务1、2 仍会被执行！
```

2、shutdownNow

```java
/**
 * 尝试停止所有正在执行的任务，停止处理等待的任务，
 * 并返回等待处理的任务列表。
 *
 * @return 从未开始执行的任务列表
 */
public List<Runnable> shutdownNow() {
    List<Runnable> tasks; // 用于存储未执行的任务的列表
    final ReentrantLock mainLock = this.mainLock; // ThreadPoolExecutor的主锁
    mainLock.lock(); // 加锁以确保独占访问

    try {
        checkShutdownAccess(); // 检查是否有关闭的权限
        advanceRunState(STOP); // 将执行器的状态更新为STOP
        interruptWorkers(); // 中断所有工作线程
        tasks = drainQueue(); // 清空队列并将结果放入任务列表中
    } finally {
        mainLock.unlock(); // 无论try块如何退出都要释放锁
    }

    tryTerminate(); // 如果条件允许，尝试终止执行器

    return tasks; // 返回队列中未被执行的任务列表
}
```

```java
List<Runnable> unexecuted = pool.shutdownNow(); // 进入 STOP
// unexecuted 包含队列中所有未执行的任务！
System.out.println("丢弃了 " + unexecuted.size() + " 个任务");
```

### 定时任务ScheduledThreadPoolExecutor类

定时任务 `ScheduledThreadPoolExecutor` 类有两个用途：指定时间延迟后执行任务；周期性重复执行任务。

JDK 1.5 之前，主要使用`Timer`类来完成定时任务，但是`Timer`有以下缺陷：

- Timer 是**单线程**模式；
- 如果在执行任务期间某个 TimerTask 耗时较久，就会影响其它任务的调度；
- Timer 的任务调度是基于绝对时间的，对**系统时间**敏感；
- Timer 不会捕获执行 TimerTask 时所抛出的**异常**，由于 Timer 是单线程的，所以一旦出现异常，线程就会终止，其他任务无法执行。

JDK5之后，我们可以使用 `ScheduledThreadPoolExecutor` 来提交定时任务，它继承自 `ThreadPoolExecutor`，并实现了 `ScheduledExecutorService` 接口并且所有的构造方法都必须要求最大线程池容量为Integer.MAX_VALUE，并且都是采用的 `DelayedWorkQueue` 作为等待队列。

![ScheduledThreadPoolExecutor-20230824085609](/juc-img/ScheduledThreadPoolExecutor-20230824085609-1767278617771-15.png)

```java
public class ScheduledThreadPoolExecutor extends ThreadPoolExecutor
	implements ScheduledExecutorService {

    public ScheduledThreadPoolExecutor(int corePoolSize,
                                       ThreadFactory threadFactory,
                                       RejectedExecutionHandler handler) {
        super(corePoolSize, Integer.MAX_VALUE, 0, NANOSECONDS,
              new DelayedWorkQueue(), threadFactory, handler);
    }
    //……
}
```

`ScheduledExecutorService` 接口继承了 `ExecutorService` 接口，并增加了几个定时相关的接口方法。

```java
public interface ScheduledExecutorService extends ExecutorService {

    /**
     * 安排一个Runnable任务在给定的延迟后执行。
     *
     * @param command 需要执行的任务
     * @param delay 延迟时间
     * @param unit 时间单位
     * @return 可用于提取结果或取消的ScheduledFuture
     */
    public ScheduledFuture<?> schedule(Runnable command, long delay, TimeUnit unit);

    /**
     * 安排一个Callable任务在给定的延迟后执行。
     *
     * @param callable 需要执行的任务
     * @param delay 延迟时间
     * @param unit 时间单位
     * @return 可用于提取结果或取消的ScheduledFuture
     */
    public <V> ScheduledFuture<V> schedule(Callable<V> callable, long delay, TimeUnit unit);

    /**
     * 安排一个Runnable任务在给定的初始延迟后首次执行，随后每个period时间间隔执行一次。
     *
     * @param command 需要执行的任务
     * @param initialDelay 首次执行的初始延迟
     * @param period 连续执行之间的时间间隔
     * @param unit 时间单位
     * @return 可用于提取结果或取消的ScheduledFuture
     */
    public ScheduledFuture<?> scheduleAtFixedRate(Runnable command,
                                                  long initialDelay,
                                                  long period,
                                                  TimeUnit unit);

    /**
     * 安排一个Runnable任务在给定的初始延迟后首次执行，随后每次完成任务后等待指定的延迟再次执行。
     *
     * @param command 需要执行的任务
     * @param initialDelay 首次执行的初始延迟
     * @param delay 每次执行结束后的延迟时间
     * @param unit 时间单位
     * @return 可用于提取结果或取消的ScheduledFuture
     */
    public ScheduledFuture<?> scheduleWithFixedDelay(Runnable command,
                                                     long initialDelay,
                                                     long delay,
                                                     TimeUnit unit);
}
```

<img src="/juc-img/ScheduledThreadPoolExecutor-20230824090447.png" alt="ScheduledThreadPoolExecutor-20230824090447" style="zoom:30%;" />

<img src="/juc-img/ScheduledThreadPoolExecutor-20230824090513.png" alt="ScheduledThreadPoolExecutor-20230824090513" style="zoom:30%;" />

#### 主要方法实现

先看看里面涉及到的几个类和接口的关系图谱：

<img src="/juc-img/ScheduledThreadPoolExecutor-cd4cead8-2ce3-4460-8ea3-9534cd4925f2.jpg" alt="img" style="zoom:40%;" />

（1）Delayed 接口

```java
// 继承Comparable接口，表示该类对象支持排序
public interface Delayed extends Comparable<Delayed> {
    // 返回该对象剩余时延
    long getDelay(TimeUnit unit);
}
```

`Delayed`接口很简单，继承了`Comparable`接口，表示对象是可以比较排序的。

（2）ScheduledFuture 接口

```java
// 仅仅继承了Delayed和Future接口，自己没有任何代码
public interface ScheduledFuture<V> extends Delayed, Future<V> {
}
```

（3）RunnableScheduledFuture 接口

```java
public interface RunnableScheduledFuture<V> extends RunnableFuture<V>, ScheduledFuture<V> {    
    // 是否是周期任务，周期任务可被调度运行多次，非周期任务只被运行一次  
    boolean isPeriodic();
}
```

（4）ScheduledFutureTask 类

回到`schecule`方法中，它创建了一个`ScheduledFutureTask`对象，由上面的关系图可知，`ScheduledFutureTask`直接或者间接实现了很多接口。

**构造方法：**

```java
ScheduledFutureTask(Runnable r, V result, long ns, long period) {
    // 调用父类FutureTask的构造方法
    super(r, result);
    // time表示任务下次执行的时间
    this.time = ns;
    // 周期任务，正数表示按照固定速率，负数表示按照固定时延,0表示不是周期任务
    this.period = period; // 默认为0
    // 任务的编号
    this.sequenceNumber = sequencer.getAndIncrement();
}
```

**Delayed 接口的实现：**

```java
// 实现Delayed接口的getDelay方法，返回任务开始执行的剩余时间
public long getDelay(TimeUnit unit) {
    return unit.convert(time - now(), TimeUnit.NANOSECONDS);
}
```

**Comparable 接口的实现：**

```java
// Comparable接口的compareTo方法，比较两个任务的”大小”。
public int compareTo(Delayed other) {
    if (other == this)
      return 0;
    if (other instanceof ScheduledFutureTask) {
      ScheduledFutureTask<?> x = (ScheduledFutureTask<?>)other;
      long diff = time - x.time;
      // 小于0，说明当前任务的执行时间点早于other，要排在延时队列other的前面
      if (diff < 0)
        return -1;
      // 大于0，说明当前任务的执行时间点晚于other，要排在延时队列other的后面
      else if (diff > 0)
        return 1;
      // 如果两个任务的执行时间点一样，比较两个任务的编号，编号小的排在队列前面，编号大的排在队列后面
      else if (sequenceNumber < x.sequenceNumber)
        return -1;
      else
        return 1;
    }
    // 如果任务类型不是ScheduledFutureTask，通过getDelay方法比较
    long d = (getDelay(TimeUnit.NANOSECONDS) -
              other.getDelay(TimeUnit.NANOSECONDS));
    return (d == 0) ? 0 : ((d < 0) ? -1 : 1);
}
```

**setNextRunTime：**

```java
// 任务执行完后，设置下次执行的时间
private void setNextRunTime() {
    long p = period;
    // p > 0，说明是固定速率运行的任务
    // 在原来任务开始执行时间的基础上加上p即可
    if (p > 0)
      time += p;
    // p < 0，说明是固定时延运行的任务，
    // 下次执行时间在当前时间(任务执行完成的时间)的基础上加上-p的时间
    else
      time = triggerTime(-p);
}
```

**Runnable 接口实现：**

```java
public void run() {
    boolean periodic = isPeriodic();
    // 如果当前状态下不能执行任务，则取消任务
    if (!canRunInCurrentRunState(periodic))
      cancel(false);
    // 不是周期性任务，执行一次任务即可，调用父类的run方法
    else if (!periodic)
      ScheduledFutureTask.super.run();
    // 是周期性任务，调用FutureTask的runAndReset方法，方法执行完成后
    // 重新设置任务下一次执行的时间，并将该任务重新入队，等待再次被调度
    else if (ScheduledFutureTask.super.runAndReset()) {
      setNextRunTime();
      reExecutePeriodic(outerTask);
    }
}
```

总结一下 run 方法的执行过程：

1. 如果当前线程池运行状态不运行执行任务，那么就取消该任务，然后直接返回，否则执行步骤 2；
2. 如果不是周期性任务，调用 FutureTask 中的 run 方法执行，会设置执行结果，然后直接返回，否则执行步骤 3；
3. 如果是周期性任务，调用 FutureTask 中的 runAndReset 方法执行，不会设置执行结果，然后直接返回，否则执行步骤 4 和步骤 5；
4. 计算下次执行该任务的具体时间；
5. 重复执行任务。

`runAndReset`方法是为任务多次执行而设计的。`runAndReset`方法执行完任务后不会设置任务的执行结果，也不会去更新任务的状态，以及维持任务的状态为初始状态（**NEW**状态），这也是该方法和 `run`方法的区别。

**1、schedule**

```java
// delay时长后执行任务command，该任务只执行一次
public ScheduledFuture<?> schedule(Runnable command, long delay, TimeUnit unit) {
    if (command == null || unit == null)
        throw new NullPointerException();
    // 这里的decorateTask方法仅仅返回第二个参数
    RunnableScheduledFuture<?> t = decorateTask(command,
                                   		new ScheduledFutureTask<Void>(command, null, triggerTime(delay,unit)));
    // 延时或者周期执行任务的主要方法
    delayedExecute(t);
    return t;
}
```

```java
// 计算任务的触发时间
private long triggerTime(long delay, TimeUnit unit) {
    return now() + unit.toNanos(delay < 0 ? 0 : delay);
}
```

**2、scheduleAtFixedRate**

```java
// 注意，固定速率和固定时延，传入的参数都是Runnable，也就是说这种定时任务是没有返回值的
public ScheduledFuture<?> scheduleAtFixedRate(Runnable command,
                                                  long initialDelay,
                                                  long period,
                                                  TimeUnit unit) {
    if (command == null || unit == null)
      throw new NullPointerException();
    if (period <= 0)
      throw new IllegalArgumentException();
    // 创建一个有初始延时和固定周期的任务
    ScheduledFutureTask<Void> sft =
      new ScheduledFutureTask<Void>(command,
                                    null,
                                    triggerTime(initialDelay, unit),
                                    unit.toNanos(period));
    RunnableScheduledFuture<Void> t = decorateTask(command, sft);
    // outerTask表示将会重新入队的任务
    sft.outerTask = t;
    delayedExecute(t);
    return t;
}
```

**3、scheduleWithFixedDelay**

```java
public ScheduledFuture<?> scheduleWithFixedDelay(Runnable command,
                                                     long initialDelay,
                                                     long delay,
                                                     TimeUnit unit) {
    if (command == null || unit == null)
      throw new NullPointerException();
    if (delay <= 0)
      throw new IllegalArgumentException();
    // 创建一个有初始延时和固定时延的任务
    ScheduledFutureTask<Void> sft =
      new ScheduledFutureTask<Void>(command,
                                    null,
                                    triggerTime(initialDelay, unit),
                                    unit.toNanos(-delay));
    RunnableScheduledFuture<Void> t = decorateTask(command, sft);
    // outerTask表示将会重新入队的任务
    sft.outerTask = t;
    // 稍后说明
    delayedExecute(t);
    return t;
}
```

**4、delayedExecute**

前面讲到的`schedule`、`scheduleAtFixedRate`和`scheduleWithFixedDelay`最后都调用了`delayedExecute`方法，该方法是定时任务执行的主要方法。 

```java
private void delayedExecute(RunnableScheduledFuture<?> task) {
    // 线程池已经关闭，调用拒绝执行处理器处理
    if (isShutdown())
      reject(task);
    else {
      // 将任务加入到等待队列
      super.getQueue().add(task);
      // 线程池已经关闭，且当前状态不能运行该任务，将该任务从等待队列移除并取消该任务
      if (isShutdown() &&
          !canRunInCurrentRunState(task.isPeriodic()) &&
          remove(task))
        task.cancel(false);
      else
        // 增加一个worker，就算corePoolSize=0也要增加一个worker
        ensurePrestart();
    }
}
```

`delayedExecute`方法的逻辑也很简单，主要就是将任务添加到等待队列，然后调用`ensurePrestart`方法。

```java
void ensurePrestart() {
    int wc = workerCountOf(ctl.get());
    if (wc < corePoolSize)
        addWorker(null, true);
    else if (wc == 0)
        addWorker(null, false);
}
```

`ensurePrestart`方法主要是调用了`addWorker` 方法，线程池中的工作线程就是通过该方法来启动并执行任务的。

对于`ScheduledThreadPoolExecutor`，`worker`添加到线程池后会在等待队列中等待获取任务，这点是和`ThreadPoolExecutor`是一致的。**但是 worker 是怎么从等待队列取定时任务的呢？**

#### DelayedWorkQueue

`ScheduledThreadPoolExecutor` 使用了 `DelayedWorkQueue` 来保存等待的任务。

该等待队列的队首应该保存的是**最近将要执行的任务**，所以`worker`只关心队首任务，如果队首任务的开始执行时间还未到，worker 也应该继续等待。

DelayedWorkQueue 是一个无界优先队列，使用数组存储，底层使用堆结构来实现优先队列的功能。

<img src="/juc-img/ScheduledThreadPoolExecutor-20230824084212.png" alt="img" style="zoom:50%;" />

可以转换成如下的数组：

<img src="/juc-img/ScheduledThreadPoolExecutor-20230824084245.png" alt="img" style="zoom:50%;" />

在这种结构中，可以发现有如下特性。假设，索引值从 0 开始，子节点的索引值为 k，父节点的索引值为 p，则：

- 一个节点的左子节点的索引为：k = p * 2 + 1；
- 一个节点的右子节点的索引为：k = (p + 1) * 2；
- 一个节点的父节点的索引为：p = (k - 1) / 2。

```java
static class DelayedWorkQueue extends AbstractQueue<Runnable>
implements BlockingQueue<Runnable> {
	// 队列初始容量
	private static final int INITIAL_CAPACITY = 16;
	// 数组用来存储定时任务，通过数组实现堆排序
	private RunnableScheduledFuture[] queue = new RunnableScheduledFuture[INITIAL_CAPACITY];
	// 当前在队首等待的线程
	private Thread leader = null;
	// 锁和监视器，用于leader线程
	private final ReentrantLock lock = new ReentrantLock();
	private final Condition available = lock.newCondition();
	// 其他代码，略
}
```

当一个线程成为 leader，它只需等待队首任务的 delay 时间即可，其他线程会无条件等待。leader 取到任务返回前要通知其他线程，直到有线程成为新的 leader。每当队首的定时任务被其他更早需要执行的任务替换，leader 就设置为 null，其他等待的线程（被当前 leader 通知）和当前的 leader 重新竞争成为 leader。

定义了 ReentrantLock 锁 lock 和 Condition available 用于控制和通知下一个线程竞争成为 leader。

DelayedWorkQueue 是一个优先级队列，它可以保证每次出队的任务都是当前队列中执行时间最靠前的，由于它是基于堆结构的队列，堆结构在执行插入和删除操作时的最坏时间复杂度是 `O(logN)`。

接下来看看`DelayedWorkQueue`中几个比较重要的方法。

1、take

```java
public RunnableScheduledFuture take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
      for (;;) {
        // 取堆顶的任务，堆顶是最近要执行的任务
        RunnableScheduledFuture first = queue[0];
        // 堆顶为空，线程要在条件available上等待
        if (first == null)
          available.await();
        else {
          // 堆顶任务还要多长时间才能执行
          long delay = first.getDelay(TimeUnit.NANOSECONDS);
          // 堆顶任务已经可以执行了，finishPoll会重新调整堆，使其满足最小堆特性，该方法设置任务在堆中的index为-1并返回该任务
          if (delay <= 0)
            return finishPoll(first);
          // 如果leader不为空，说明已经有线程成为leader并等待堆顶任务
          // 到达执行时间，此时，其他线程都需要在available条件上等待
          else if (leader != null)
            available.await();
          else {
            // leader为空，当前线程成为新的leader
            Thread thisThread = Thread.currentThread();
            leader = thisThread;
            try {
              // 当前线程已经成为leader了，只需要等待堆顶任务到达执行时间即可
              available.awaitNanos(delay);
            } finally {
              // 返回堆顶元素之前将leader设置为空
              if (leader == thisThread)
                leader = null;
            }
          }
        }
      }
    } finally {
      // 通知其他在available条件等待的线程，这些线程可以去竞争成为新的leader
      if (leader == null && queue[0] != null)
        available.signal();
      lock.unlock();
    }
}
```

在讲解线程池的时候，我们介绍了`getTask`方法，工作线程会循环从`workQueue`中取任务。但计划任务却不同，因为一旦`getTask`方法取出了任务就开始执行了，而这时可能还没有到执行时间，所以在`take`方法中，要保证只有到指定的执行时间，任务才可以被取走。

总结一下流程：

1. 如果堆顶元素为空，在 available 上等待。
2. 如果堆顶任务的执行时间已到，将堆顶元素替换为堆的最后一个元素并调整堆使其满足**最小堆**特性，同时设置任务在堆中索引为-1，返回该任务。
3. 如果 leader 不为空，说明已经有线程成为 leader 了，其他线程都要在 available 监视器上等待。
4. 如果 leader 为空，当前线程成为新的 leader，并等待直到堆顶任务执行时间到达。
5. take 方法返回之前，将 leader 设置为空，并通知其他线程。

2、offer

该方法往队列插入一个值，返回是否成功插入。

```java
public boolean offer(Runnable x) {
    if (x == null)
      throw new NullPointerException();
    RunnableScheduledFuture e = (RunnableScheduledFuture)x;
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
      int i = size;
      // 队列元素已经大于等于数组的长度，需要扩容，新堆的容量是原来堆容量的1.5倍
      if (i >= queue.length)
        grow();
      // 堆中元素增加1
      size = i + 1;
      // 调整堆
      if (i == 0) {
        queue[0] = e;
        setIndex(e, 0);
      } else {
          // 调整堆，使的满足最小堆，比较大小的方式就是上文提到的compareTo方法
        siftUp(i, e);
      }
      if (queue[0] == e) {
        leader = null;
        // 通知其他在available条件上等待的线程，这些线程可以竞争成为新的leader
        available.signal();
      }
    } finally {
      lock.unlock();
    }
    return true;
}
```

offer 方法实现了向延迟队列插入一个任务的操作，并保证整个队列仍然满足最小堆的性质。

> 最小堆（Min Heap）是一个完全二叉树，其中每一个父节点的值都小于或等于其子节点的值。换句话说，在最小堆中，根节点（即树的顶部）是所有节点中的最小值。

前面我们也提到过最小堆。我们来看一下用于调整堆的 siftUp 方法。

```java
private void siftUp(int k, RunnableScheduledFuture<?> key) {
    while (k > 0) {
        // 找到父节点的索引
        int parent = (k - 1) >>> 1;
        // 获取父节点
        RunnableScheduledFuture<?> e = queue[parent];
        // 如果key节点的执行时间大于父节点的执行时间，不需要再排序了
        if (key.compareTo(e) >= 0)
            break;
        // 如果key.compareTo(e) < 0，说明key节点的执行时间小于父节点的执行时间，需要把父节点移到后面
        queue[k] = e;
        // 设置索引为k
        setIndex(e, k);
        k = parent;
    }
    // key设置为排序后的位置中
    queue[k] = key;
    setIndex(key, k);
}
```

代码很好理解，就是循环的根据key节点与它的父节点来判断，如果key节点的执行时间小于父节点，则将两个节点交换，使执行时间靠前的节点排列在队列的前面。

假设新入队的节点的延迟时间（调用getDelay()方法获得）是5，执行过程如下：

1、先将新的节点添加到数组的尾部，这时新节点的索引k为7：

![img](/juc-img/ScheduledThreadPoolExecutor-20230824091455.png)

2、计算新父节点的索引：`parent = (k - 1) >>> 1`，parent = 3，那么`queue[3]`的时间间隔值为8，因为 `5 < 8` ，将执行`queue[7] = queue[3]`：

![img](/juc-img/ScheduledThreadPoolExecutor-20230824091531.png)

3、这时将k设置为3，继续循环，再次计算parent为1，`queue[1]`的时间间隔为3，因为 `5 > 3` ，这时退出循环，最终k为3：

![img](/juc-img/ScheduledThreadPoolExecutor-20230824091558.png)

可见，每次新增节点时，只是根据父节点来判断，而不会影响兄弟节点。

### 线程池使用场景

#### Web服务器模拟

Web服务器通常需要处理I/O操作，比如网络I/O，因此它们被视为I/O密集型任务。因此，我们将线程数设置为2 * CPU核心数。

```java
import java.util.concurrent.*;

public class SimpleWebServer {
    private static final int CPU_COUNT = Runtime.getRuntime().availableProcessors();
    private static final int CORE_POOL_SIZE = 2 * CPU_COUNT;
    private static final int MAX_POOL_SIZE = 2 * CPU_COUNT + 1;

    private static final ThreadPoolExecutor exec = new ThreadPoolExecutor(
            CORE_POOL_SIZE,
            MAX_POOL_SIZE,
            60L,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(1000)
    );

    public static void main(String[] args) {
        while (true) {
            Runnable request = () -> System.out.println("Request handled by " + Thread.currentThread().getName());

            exec.execute(request);
        }
    }
}
```

#### 并行计算

并行计算任务主要用于计算，没有I/O阻塞，所以它们是CPU密集型的。线程数设置为CPU核心数 + 1。

```java
import java.util.*;
import java.util.concurrent.*;

public class ParallelCalculation {
    private static final int CPU_COUNT = Runtime.getRuntime().availableProcessors();
    private static final int CORE_POOL_SIZE = CPU_COUNT + 1;
    private static final int MAX_POOL_SIZE = CPU_COUNT * 2;

    private static final ThreadPoolExecutor exec = new ThreadPoolExecutor(
            CORE_POOL_SIZE,
            MAX_POOL_SIZE,
            10L,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(1000)
    );

    public static void main(String[] args) {
        Callable<Double> task = () -> Math.random() * 100;

        List<Future<Double>> results = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            results.add(exec.submit(task));
        }

        for (Future<Double> result : results) {
            try {
                System.out.println(result.get());
            } catch (InterruptedException | ExecutionException e) {
                e.printStackTrace();
            }
        }

        exec.shutdown();
    }
}
```

#### 异步任务处理

异步任务通常涉及到I/O操作，比如数据库查询或文件读写，因此它们被视为I/O密集型任务。因此，我们将线程数设置为2 * CPU核心数。

```java
import java.util.concurrent.*;

public class AsynchronousTaskProcessor {
    private static final int CPU_COUNT = Runtime.getRuntime().availableProcessors();
    private static final int CORE_POOL_SIZE = 2 * CPU_COUNT;
    private static final int MAX_POOL_SIZE = 2 * CPU_COUNT + 2;

    private static final ThreadPoolExecutor exec = new ThreadPoolExecutor(
            CORE_POOL_SIZE,
            MAX_POOL_SIZE,
            60L,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(1000)
    );

    public static void main(String[] args) {
        exec.execute(() -> {
            System.out.println("Async task started");
            try {
                Thread.sleep(2000);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            System.out.println("Async task completed");
        });

        System.out.println("Main thread continues to execute other operations.");
        exec.shutdown();
    }
}
```

### 自定义实现线程池demo（不考虑线程安全）

```java
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

public class MyThreadPool {
    private int corePoolSize;
    private int maxPoolSize;
    private long keepAliveTime;
    private TimeUnit unit;
    private BlockingQueue<Runnable> workQueue;

    // 当前活跃线程数（简化计数）
    private int currentThreadCount = 0;

    public MyThreadPool(int corePoolSize, int maxPoolSize, long keepAliveTime, TimeUnit unit, BlockingQueue<Runnable> workQueue) {
        this.corePoolSize = corePoolSize;
        this.maxPoolSize = maxPoolSize;
        this.keepAliveTime = keepAliveTime;
        this.unit = unit;
        this.workQueue = workQueue;
    }

    public void execute(Runnable command) {
        if (command == null) throw new NullPointerException();

        // 1. 如果当前线程数 < core，创建核心线程执行任务
        if (currentThreadCount < corePoolSize) {
            addWorker(command, true); // true 表示核心线程
            return;
        }

        // 2. 尝试入队
        if (workQueue.offer(command)) {
            return;
        }

        // 3. 入队失败（队列满），尝试创建非核心线程
        if (currentThreadCount < maxPoolSize) {
            addWorker(command, false); // false 表示非核心线程
            return;
        }

        // 4. 拒绝策略
        throw new RuntimeException("ThreadPool is full and queue is full: task rejected");
    }

    // 创建并启动一个工作线程，firstTask 是它要执行的第一个任务
    private void addWorker(Runnable firstTask, boolean isCore) {
        Worker worker = new Worker(firstTask, isCore);
        Thread thread = new Thread(worker);
        thread.start();
        currentThreadCount++; // 注意：此处非线程安全，仅用于单线程提交场景
    }

    // 工作线程封装
    private class Worker implements Runnable {
        private final Runnable firstTask;
        private final boolean isCore;

        Worker(Runnable firstTask, boolean isCore) {
            this.firstTask = firstTask;
            this.isCore = isCore;
        }

        @Override
        public void run() {
            Runnable task = firstTask; // 先执行传入的任务

            try {
                while (task != null || (task = getTask()) != null) {
                    try {
                        task.run();
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                    task = null; // 执行完置空，下一轮从队列取
                }
            } finally {
                // 线程退出，减少计数（非线程安全）
                currentThreadCount--;
                if (!isCore) {
                    System.out.println(Thread.currentThread().getName() + " 非核心线程结束了！");
                }
            }
        }

        // 从队列获取任务：核心线程用 take()（永久阻塞），非核心用 poll(timeout)
        private Runnable getTask() {
            try {
                if (isCore) {
                    return workQueue.take(); // 阻塞直到有任务
                } else {
                    return workQueue.poll(keepAliveTime, unit); // 超时回收
                }
            } catch (InterruptedException e) {
                return null; // 被中断时退出
            }
        }
    }

    // 测试
    public static void main(String[] args) throws InterruptedException {
        MyThreadPool pool = new MyThreadPool(
                2,                      // corePoolSize
                4,                      // maxPoolSize
                1,                      // keepAliveTime
                TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(2) // 有界队列
        );

        for (int i = 0; i < 6; i++) {
            final int taskId = i;
            pool.execute(() -> {
                try {
                    Thread.sleep(1000); // 模拟任务耗时
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                System.out.println(Thread.currentThread().getName() + " executed task " + taskId);
            });
        }

        System.out.println("主线程没有被阻塞");

        // 等待所有任务完成（便于观察输出）
        Thread.sleep(5000);
    }
    // 结果：
    // 主线程没有被阻塞
    // Thread-0 executed task 0
    // Thread-1 executed task 1
    // Thread-2 executed task 2
    // Thread-3 executed task 3
    // Thread-0 executed task 4
    // Thread-1 executed task 5
    // Thread-2 非核心线程结束了！
    // Thread-3 非核心线程结束了！
}
```

## 十五、线程局部存储 & 生产者-消费者模型

### ThreadLocal（未整理）

https://javabetter.cn/thread/ThreadLocal.html

既然每个线程都有一个自己的工作内存，那么能否只在自己的工作内存中创建变量仅供线程自己使用呢？

不同线程向ThreadLocal存放数据，只会存放在线程自己的工作内存中（只能存储一个变量），而不会直接存放到主内存中，因此各个线程直接存放的内容互不干扰。不同的线程访问到ThreadLocal对象时，也都只能获取到当前线程所属的变量。

```java
public static void main(String[] args) throws InterruptedException {
    ThreadLocal<String> local = new ThreadLocal<>();  //注意这是一个泛型类，存储类型为我们要存放的变量类型
    Thread t1 = new Thread(() -> {
        local.set("lbwnb");   //将变量的值给予ThreadLocal
        System.out.println("线程1变量值已设定！");
        try {
            Thread.sleep(2000);    //间隔2秒
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println("线程1读取变量值：");
        System.out.println(local.get());   //尝试获取ThreadLocal中存放的变量
    });
    Thread t2 = new Thread(() -> {
        local.set("yyds");   //将变量的值给予ThreadLocal
        System.out.println("线程2变量值已设定！");
    });
    t1.start();
    Thread.sleep(1000);    //间隔1秒
    t2.start();
}
```

* 在线程中创建的子线程，无法获得父线程工作内存中的变量：

  ```java
  public static void main(String[] args) {
      ThreadLocal<String> local = new ThreadLocal<>();
      Thread t = new Thread(() -> {
         local.set("lbwnb");
          new Thread(() -> {
              System.out.println(local.get());
          }).start();
      });
      t.start();
  }
  ```

  可以使用 `InheritableThreadLocal` 来解决：

  ```java
  public static void main(String[] args) {
      ThreadLocal<String> local = new InheritableThreadLocal<>();
      Thread t = new Thread(() -> {
         local.set("lbwnb");
          new Thread(() -> {
              System.out.println(local.get());
          }).start();
      });
      t.start();
  }
  ```

  在InheritableThreadLocal存放的内容，会自动向子线程传递。

 同步模式之顺序控制

#### 固定运行顺序

- 例如必须先执行线程2再执行线程1

  - 使用`wait notify`来解决，使用此种凡事，需保证先wait再notify，否则wait线程永远得不到唤醒。因此需要设立了一个isT2Ran字段来判断该不该wait。

    ```
    @Slf4j(topic = "c.WaitNotify")
    public class Test01 {
        static Object obj = new Object();
        static boolean isT2Ran = false;
    
        public static void main(String[] args) {
            new Thread(() -> {
                synchronized (obj) {
                    // 如果t2没有执行过
                    while (!isT2Ran) {
                        try {
                            // 那么t1等待
                            obj.wait();
                        } catch (InterruptedException e) {
                            throw new RuntimeException(e);
                        }
                    }
                    log.debug("1");
                }
            }, "t1").start();
    
            new Thread(() -> {
                log.debug("2");
                synchronized (obj) {
                    // t2执行的时候修改标记
                    isT2Ran = true;
                    // 并且唤醒等待的线程
                    obj.notifyAll();
                }
            }, "t2").start();
    
        }
    }
    ```

  - 除此之外还可以使用park和unpark来解决，代码更为简洁，这里的unpark的作用于设立的isT2Ran的作用类似，都可以起到通知t1线程，t2线程已经执行过了的作用。使用此种方式更为灵活，无论t1线程和t2线程的调用顺序如何，都是以线程为单位暂停和恢复，不需要同步对象(obj)和运行标记(isT2Ran)

    ```
    @Slf4j(topic = "c.ParkUnpark")
    public class Test02 {
        public static void main(String[] args) {
            Thread t1 = new Thread(() -> {
                // 当t1线程没有许可的时候，t1线程会暂停，有许可的时候，用掉这个许可，恢复当前线程执行
                LockSupport.park();
                log.debug("1");
            }, "t1");
    
            Thread t2 = new Thread(() -> {
                // 给t1线程发放许可
                LockSupport.unpark(t1);
                log.debug("2");
            }, "t2");
    
            t1.start();
            t2.start();
        }
    }
    ```

#### 交替输出

- t1输出a五次，t2输出b五次，t3输出c五次

  - 使用`wait notify`来解决

    - SyncWaitNotify

    ```
    /**
     * 输出内容     等待标记        下一个标记
     *   a          1               2
     *   b          2               3
     *   c          3               1
     */
    @Slf4j(topic = "c.SyncWaitNotify")
    public class SyncWaitNotify {
        // 等待标识
        private int flag;
        // 循环次数
        private int loopNum;
    
        public SyncWaitNotify(int flag, int loopNum) {
            this.flag = flag;
            this.loopNum = loopNum;
        }
    
        /**
         *
         * @param str       输出内容
         * @param waitFlag  等待标记
         * @param nextFlag  下一个标记
         */
        public void print(String str, int waitFlag, int nextFlag) {
            for (int i = 0; i < loopNum; i++) {
    
                synchronized (this) {
                    while (flag != waitFlag) {
                        try {
                            this.wait();
                        } catch (InterruptedException e) {
                            throw new RuntimeException(e);
                        }
                    }
                    log.debug(str);
                    flag = nextFlag;
                    this.notifyAll();
                }
            }
        }
    }
    ```

    测试类

    ```java
    public class Test03 {
    
        public static void main(String[] args) {
            SyncWaitNotify syncWaitNotify = new SyncWaitNotify(1, 5);
            new Thread(() -> {
                syncWaitNotify.print("a", 1, 2);
            }, "t1").start();
    
            new Thread(() -> {
                syncWaitNotify.print("b", 2, 3);
            }, "t2").start();
    
            new Thread(() -> {
                syncWaitNotify.print("c", 3, 1);
            }, "t3").start();
        }
    }
    ```

    

  - 使用await和signal来解决

    ```
    public class SyncAwaitSignal {
        public static void main(String[] args) {
            AwaitSignal awaitSignal = new AwaitSignal(5);
            Condition a = awaitSignal.newCondition();
            Condition b = awaitSignal.newCondition();
            Condition c = awaitSignal.newCondition();
            new Thread(() -> {
                awaitSignal.print("a", a, b);
            }, "t1").start();
            new Thread(() -> {
                awaitSignal.print("b", b, c);
            }, "t2").start();
            new Thread(() -> {
                awaitSignal.print("c", c, a);
            }, "t3").start();
    
            awaitSignal.start(a);
        }
    }
    
    @Slf4j(topic = "c.AwaitSignal")
    class AwaitSignal extends ReentrantLock {
    
        private int loopNum;
    
        public AwaitSignal(int loopNum) {
            this.loopNum = loopNum;
        }
    
        public void print(String str, Condition current, Condition next) {
            for (int i = 0; i < loopNum; i++) {
                this.lock();
                try {
                    // 每个线程都先进自己的休息室等待
                    current.await();
                    log.debug(str);
                    // 叫醒下一个
                    next.signal();
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                } finally {
                    this.unlock();
                }
            }
        }
    
        public void start(Condition condition) {
            this.lock();
            try {
                condition.signal();
            } finally {
                this.unlock();
            }
        }
    }
    ```

  - 使用Park和Unpark来解决

    ```
    public class SyncParkUnpark {
        static Thread t1;
        static Thread t2;
        static Thread t3;
    
        public static void main(String[] args) {
            ParkUnpark parkUnpark = new ParkUnpark(5);
            t1 = new Thread(() -> {
                parkUnpark.print("a", t2);
            }, "t1");
            t2 = new Thread(() -> {
                parkUnpark.print("b", t3);
    
            }, "t2");
            t3 = new Thread(() -> {
                parkUnpark.print("c", t1);
            }, "t3");
    
            t1.start();
            t2.start();
            t3.start();
    
            LockSupport.unpark(t1);
        }
    }
    
    @Slf4j(topic = "c.ParkUnpark")
    class ParkUnpark {
        private int loopNum;
    
        public ParkUnpark(int loopNum) {
            this.loopNum = loopNum;
        }
    
        public void print(String str, Thread next) {
            for (int i = 0; i < loopNum; i++) {
                LockSupport.park();
                log.debug(str);
                LockSupport.unpark(next);
            }
        }
    }
    ```

### 生产者-消费者模式

生产者-消费者模式是一个十分经典的多线程并发协作模式，弄懂生产者-消费者问题能够让我们对并发编程的理解加深。

所谓的生产者-消费者，实际上包含了两类线程，一种是生产者线程用于生产数据，另一种是消费者线程用于消费数据，为了解耦生产者和消费者的关系，通常会采用共享的数据区域，就像是一个仓库，生产者生产数据之后直接放置在共享数据区中，并不需要关心消费者的行为；而消费者只需要从共享数据区中获取数据，不需要关心生产者的行为。

<img src="/juc-img/shengchanzhe-xiaofeizhe-20230825161048.png" alt="img" style="zoom: 25%;" />

这个共享数据区域中应该具备这样的线程间并发协作功能：

1. 如果共享数据区已满的话，阻塞生产者继续生产数据；
2. 如果共享数据区为空的话，阻塞消费者继续消费数据；

在实现生产者消费者问题时，可以采用三种方式：

1. 使用 Object 的 wait/notify 的消息通知机制；
2. 使用 Lock Condition 的 await/signal 消息通知机制；
3. 使用 BlockingQueue 实现。

| 特性         | 1. `synchronized + wait/notify`        | 2. `ReentrantLock + Condition`           | 3. `BlockingQueue`（推荐）    |
| ------------ | -------------------------------------- | ---------------------------------------- | ----------------------------- |
| 实现复杂度   | 高（需手动管理锁、条件、循环检查）     | 中（需注意 lock/unlock 和 await/signal） | 极低（一行 `put/take` 解决）  |
| 线程安全性   | ✅ 手动保证                             | ✅ 手动保证                               | ✅ 内置线程安全                |
| 阻塞机制     | 手动 `wait()` / `notifyAll()`          | `await()` / `signalAll()`                | 自动阻塞（`put`/`take`）      |
| 唤醒精准性   | ❌ `notifyAll()` 唤醒所有（含无关线程） | ✅ 可为不同条件创建独立 `Condition`       | ✅ 内部高效管理等待队列        |
| 异常处理     | 需处理 `InterruptedException`          | 需处理 `InterruptedException`            | 需处理 `InterruptedException` |
| 性能         | 一般（竞争激烈时）                     | 较好（可公平锁、超时等）                 | 优秀（JUC 优化，高并发友好）  |
| 代码可读性   | 差（样板代码多）                       | 中                                       | 极好（业务逻辑清晰）          |
| 是否推荐     | ❌ 仅用于学习原理                       | ⚠️ 特殊场景（如需超时、公平性）           | ✅ 首选方案                    |
| 典型使用场景 | 教学、面试题                           | 需要精细控制线程协作                     | 实际项目开发                  |

#### wait/notify 的消息通知机制

可以通过 Object 对象的 wait 方法和 notify 方法或 notifyAll 方法来实现线程间的通信。

<img src="/juc-img/shengchanzhe-xiaofeizhe-20230825160634.png" alt="img" style="zoom: 33%;" />

调用 wait 方法将阻塞当前线程，直到其他线程调用了 notify 方法或 notifyAll 方法进行通知，当前线程才能从 wait 方法处返回，继续执行下面的操作。

1、wait

该方法用来将当前线程置入休眠状态，直到接到通知或被中断为止。

在调用 wait 之前，线程必须获得该对象的监视器锁，即只能在**同步方法或同步块**中调用 wait 方法。调用 wait 方法之后，当前线程会释放锁。如果调用 wait 方法时，线程并未获取到锁的话，则会**抛出 IllegalMonitorStateException**异常。如果再次获取到锁的话，当前线程才能从 wait 方法处成功返回。

2、notify

该方法也需要在同步方法或同步块中调用，即在调用前，线程也必须获得该对象的对象级别锁，如果调用 notify 时没有持有适当的锁，也会抛出 **IllegalMonitorStateException**。

该方法会从 WAITTING 状态的线程中挑选一个进行通知，使得调用 wait 方法的线程从等待队列移入到同步队列中，等待机会再一次获取到锁，从而使得调用 wait 方法的线程能够从 wait 方法处退出。

调用 notify 后，当前线程不会马上释放该对象锁，要等到程序退出同步块后，当前线程才会释放锁。

3、notifyAll

该方法与 notify 方法的工作方式相同，重要的一点差异是：notifyAll 会使所有原来在该对象上 wait 线程统统退出 WAITTING 状态，使得他们全部从等待队列中移入到同步队列中去，等待下一次获取到对象监视器锁的机会。

不过，wait/notify 消息通知存在这样一些问题。

**1、notify 早期通知**

notify 通知的遗漏，即 threadA 还没开始 wait，threadB 已经 notify 了，这样，threadB 通知是没有任何响应的，当 threadB 退出 synchronized 代码块后，threadA 再开始 wait，便会一直阻塞等待，直到被别的线程打断。

```java
public class EarlyNotify {

    private static String lockObject = "";

    public static void main(String[] args) {
        WaitThread waitThread = new WaitThread(lockObject);
        NotifyThread notifyThread = new NotifyThread(lockObject);
        notifyThread.start();
        try {
            Thread.sleep(3000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        waitThread.start();
    }

    static class WaitThread extends Thread {
        private String lock;

        public WaitThread(String lock) {
            this.lock = lock;
        }

        @Override
        public void run() {
            synchronized (lock) {
                try {
                    System.out.println(Thread.currentThread().getName() + "  进去代码块");
                    System.out.println(Thread.currentThread().getName() + "  开始wait");
                    lock.wait();
                    System.out.println(Thread.currentThread().getName() + "   结束wait");
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }
        }
    }

    static class NotifyThread extends Thread {
        private String lock;

        public NotifyThread(String lock) {
            this.lock = lock;
        }

        @Override
        public void run() {
            synchronized (lock) {
                System.out.println(Thread.currentThread().getName() + "  进去代码块");
                System.out.println(Thread.currentThread().getName() + "  开始notify");
                lock.notify();
                System.out.println(Thread.currentThread().getName() + "   结束开始notify");
            }
        }
    }
}
```

示例中开启了**两个线程，一个是 WaitThread，另一个是 NotifyThread。NotifyThread 会先启动调用 notify 方法。然后 WaitThread 线程才启动，调用 wait 方法，但由于通知过了，wait 方法就无法再获取到相应的通知，因此 WaitThread 会一直在 wait 方法处阻塞，这种现象就是通知过早的现象。**

针对这种问题的解决方法是，添加一个状态标志，让 waitThread 调用 wait 方法前先判断状态是否已经改变了，如果通知已经发出，WaitThread 就不再去 wait。对上面的代码进行优化如下：

```java
public class EarlyNotify {

    private static String lockObject = "";
    private static boolean isWait = true;

    public static void main(String[] args) {
        WaitThread waitThread = new WaitThread(lockObject);
        NotifyThread notifyThread = new NotifyThread(lockObject);
        notifyThread.start();
        try {
            Thread.sleep(3000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        waitThread.start();
    }

    static class WaitThread extends Thread {
        private String lock;

        public WaitThread(String lock) {
            this.lock = lock;
        }

        @Override
        public void run() {
            synchronized (lock) {
                try {
                    while (isWait) {
                        System.out.println(Thread.currentThread().getName() + "  进去代码块");
                        System.out.println(Thread.currentThread().getName() + "  开始wait");
                        lock.wait();
                        System.out.println(Thread.currentThread().getName() + "   结束wait");
                    }
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }
        }
    }

    static class NotifyThread extends Thread {
        private String lock;

        public NotifyThread(String lock) {
            this.lock = lock;
        }

        @Override
        public void run() {
            synchronized (lock) {
                System.out.println(Thread.currentThread().getName() + "  进去代码块");
                System.out.println(Thread.currentThread().getName() + "  开始notify");
                lock.notifyAll();
                isWait = false;
                System.out.println(Thread.currentThread().getName() + "   结束开始notify");
            }
        }
    }
}
```

这段代码只增加了一个`isWait`状态，NotifyThread 调用 notify 方法后会对状态进行更新，WaitThread 调用 wait 方法之前会先对状态进行判断。

该示例中，调用 notify 后将状态`isWait`改变为 false，因此，在 WaitThread 中 while 对 isWait 判断后就不会执行 wait 方法，从而**避免了 Notify 过早通知造成遗漏的情况。**

**总结：在使用线程的等待/通知机制时，一般都要配合一个 boolean 变量值，在 notify 之前改变该 boolean 变量的值，让 wait 返回后能够退出 while 循环，或在通知被遗漏后不会被阻塞在 wait 方法处。**

**2、等待 wait 的条件发生变化**

如果线程在等待时接收到了通知，但是之后等待的条件发生了变化，并没有再次对等待条件进行判断，也会导致程序出现错误。

```java
public class ConditionChange {
	private static List<String> lockObject = new ArrayList();


	public static void main(String[] args) {
	    Consumer consumer1 = new Consumer(lockObject);
	    Consumer consumer2 = new Consumer(lockObject);
	    Productor productor = new Productor(lockObject);
	    consumer1.start();
	    consumer2.start();
	    productor.start();
	}


	static class Consumer extends Thread {
	    private List<String> lock;

	    public Consumer(List lock) {
	        this.lock = lock;
	    }

	    @Override
	    public void run() {
	        synchronized (lock) {
	            try {
	                //这里使用if的话，就会存在wait条件变化造成程序错误的问题
	                if (lock.isEmpty()) {
	                    System.out.println(Thread.currentThread().getName() + " list为空");
	                    System.out.println(Thread.currentThread().getName() + " 调用wait方法");
	                    lock.wait();
	                    System.out.println(Thread.currentThread().getName() + "  wait方法结束");
	                }
	                String element = lock.remove(0);
	                System.out.println(Thread.currentThread().getName() + " 取出第一个元素为：" + element);
	            } catch (InterruptedException e) {
	                e.printStackTrace();
	            }
	        }
	    }

	}


	static class Productor extends Thread {
	    private List<String> lock;

	    public Productor(List lock) {
	        this.lock = lock;
	    }

	    @Override
	    public void run() {
	        synchronized (lock) {
	            System.out.println(Thread.currentThread().getName() + " 开始添加元素");
	            lock.add(Thread.currentThread().getName());
	            lock.notifyAll();
	        }
	    }

	}
}
```

会报异常：

```bash
Exception in thread "Thread-1" Thread-0 list为空
Thread-0 调用wait方法
Thread-1 list为空
Thread-1 调用wait方法
Thread-2 开始添加元素
Thread-1  wait方法结束
java.lang.IndexOutOfBoundsException: Index: 0, Size: 0
```

在这个例子中，一共开启了 3 个线程，Consumer1、Consumer2 以及 Productor。

Consumer1 调用了 wait 方法后，线程处于了 WAITTING 状态，并且将对象锁释放。

此时，Consumer2 获取到对象锁，进入到同步代块中，当执行到 wait 方法时，同样的也会释放对象锁。

然后 productor 获取到对象锁，进入到同步代码块中，向 list 中插入数据，通过 notifyAll 方法通知处于 WAITING 状态的 Consumer1 和 Consumer2 线程。

consumer1 得到对象锁后，从 wait 方法处退出，删除一个元素让 List 为空，方法执行结束，退出同步块，释放掉对象锁。

这个时候 Consumer2 获取到对象锁后，从 wait 方法退出，继续往下执行，这个时候 Consumer2 再执行`lock.remove(0);`就会出错，因为 List 已经为空了。

**解决方案：** 通过上面的分析，可以看出 Consumer2 报错是因为线程从 wait 方法退出之后没有对 wait 条件进行判断，但此时的 wait 条件已经发生了变化。解决办法就是在 wait 退出之后再对条件进行判断。

```java
public class ConditionChange {
	private static List<String> lockObject = new ArrayList();


	public static void main(String[] args) {
	    Consumer consumer1 = new Consumer(lockObject);
	    Consumer consumer2 = new Consumer(lockObject);
	    Productor productor = new Productor(lockObject);
	    consumer1.start();
	    consumer2.start();
	    productor.start();
	}


	static class Consumer extends Thread {
	    private List<String> lock;

	    public Consumer(List lock) {
	        this.lock = lock;
	    }

	    @Override
	    public void run() {
	        synchronized (lock) {
	            try {
	                //这里使用if的话，就会存在wait条件变化造成程序错误的问题
	                while (lock.isEmpty()) {
	                    System.out.println(Thread.currentThread().getName() + " list为空");
	                    System.out.println(Thread.currentThread().getName() + " 调用wait方法");
	                    lock.wait();
	                    System.out.println(Thread.currentThread().getName() + "  wait方法结束");
	                }
	                String element = lock.remove(0);
	                System.out.println(Thread.currentThread().getName() + " 取出第一个元素为：" + element);
	            } catch (InterruptedException e) {
	                e.printStackTrace();
	            }
	        }
	    }

	}


	static class Productor extends Thread {
	    private List<String> lock;

	    public Productor(List lock) {
	        this.lock = lock;
	    }

	    @Override
	    public void run() {
	        synchronized (lock) {
	            System.out.println(Thread.currentThread().getName() + " 开始添加元素");
	            lock.add(Thread.currentThread().getName());
	            lock.notifyAll();
	        }
	    }

	}
}
```

上面的代码与之前的代码相比，仅仅只是将 wait 外围的 if 语句改为了 while 循环，这样当 list 为空时，线程便会继续等待，而不会继续去执行删除 list 中元素中的代码。

**总结：在使用线程的等待/通知机制时，一般都要在 while 循环中调用 wait 方法，因此需要配合一个 boolean 变量，满足 while 循环的条件时进入 while 循环，执行 wait 方法，不满足 while 循环条件时，跳出循环，执行后面的代码。**

**3、“假死”状态**

- 所有线程（生产者和消费者）都在**同一个对象的 wait set** 中。
- `notify()` 只唤醒一个线程，但**无法控制唤醒的是生产者还是消费者**。
- 如果当前状态是“缓冲区空”，你应该唤醒**生产者**；
- 但如果 `notify()` 唤醒了**消费者**，它会发现缓冲区还是空，于是**再次 wait**。

**解决办法：将 notify 方法替换成 notifyAll 方法，如果使用的是 lock 的话，就将 signal 方法替换成 signalAll 方法。**

基本的使用范式如下：

```java
// The standard idiom for calling the wait method in Java
synchronized (sharedObject) {
    while (condition) {
        sharedObject.wait();
        // (Releases lock, and reacquires on wakeup)
    }
    // do action based upon condition e.g. take or put into queue
}
```

#### wait/notifyAll 实现生产者-消费者

```java
public class ProductorConsumer {

    public static void main(String[] args) {
        // 共享的数据缓冲区（线程不安全，需手动同步）
        LinkedList linkedList = new LinkedList();
        
        // 创建固定大小为15的线程池（5个生产者 + 10个消费者）
        ExecutorService service = Executors.newFixedThreadPool(15);
        
        // 启动5个生产者线程
        for (int i = 0; i < 5; i++) {
            service.submit(new Productor(linkedList, 8)); // 缓冲区最大容量为8
        }

        // 启动10个消费者线程
        for (int i = 0; i < 10; i++) {
            service.submit(new Consumer(linkedList));
        }
        
        // 注意：这里没有 shutdown()，程序会一直运行（因为生产/消费是 while(true)）
    }

    // 生产者类
    static class Productor implements Runnable {

        private List<Integer> list;      // 共享缓冲区
        private int maxLength;           // 缓冲区最大容量

        public Productor(List list, int maxLength) {
            this.list = list;
            this.maxLength = maxLength;
        }

        @Override
        public void run() {
            while (true) { // 持续生产
                synchronized (list) { // 对共享资源加锁，确保线程安全
                    try {
                        // 【关键点1】缓冲区满时，生产者等待
                        while (list.size() == maxLength) {
                            System.out.println("生产者" + Thread.currentThread().getName() + "  list已达最大容量，进行wait");
                            list.wait(); // 释放锁并进入等待状态
                            System.out.println("生产者" + Thread.currentThread().getName() + "  退出wait");
                        }

                        // 生成随机数据
                        Random random = new Random();
                        int i = random.nextInt();
                        System.out.println("生产者" + Thread.currentThread().getName() + " 生产数据 " + i);
                        
                        // 将数据加入缓冲区
                        list.add(i);
                        
                        // 【关键点2】通知所有等待的线程（可能是消费者）
                        list.notifyAll(); // 唤醒因 wait() 阻塞的线程
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
                // 注意：synchronized 块结束后自动释放锁
            }
        }
    }

    // 消费者类
    static class Consumer implements Runnable {

        private List<Integer> list; // 共享缓冲区

        public Consumer(List list) {
            this.list = list;
        }

        @Override
        public void run() {
            while (true) { // 持续消费
                synchronized (list) { // 获取共享资源的锁
                    try {
                        // 【关键点3】缓冲区为空时，消费者等待
                        while (list.isEmpty()) {
                            System.out.println("消费者" + Thread.currentThread().getName() + "  list为空，进行wait");
                            list.wait(); // 释放锁，等待生产者唤醒
                            System.out.println("消费者" + Thread.currentThread().getName() + "  退出wait");
                        }

                        // 从缓冲区头部取出一个元素（FIFO）
                        Integer element = list.remove(0);
                        System.out.println("消费者" + Thread.currentThread().getName() + "  消费数据：" + element);
                        
                        // 【关键点4】通知所有等待的线程（可能是生产者）
                        list.notifyAll(); // 唤醒可能在等待的生产者
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
            }
        }
    }
}
```

输出结果：

<img src="/juc-img/image-20260118173353507.png" alt="image-20260118173353507" style="zoom:50%;" />

#### await/signalAll 实现生产者-消费者

```java
public class ProductorConsumer {

    // 🔑 共享的可重入锁（替代 synchronized）
    private static ReentrantLock lock = new ReentrantLock();

    // 📌 条件变量：用于“缓冲区满”时生产者等待
    private static Condition full = lock.newCondition();   // 对应 synchronized 中的 wait/notify 逻辑

    // 📌 条件变量：用于“缓冲区空”时消费者等待
    private static Condition empty = lock.newCondition();  // 拆分了 wait 队列，比 notifyAll 更精准高效

    public static void main(String[] args) {
        // 共享缓冲区（线程不安全，需通过 lock 保护）
        LinkedList<Integer> linkedList = new LinkedList<>();

        // 创建 15 个线程的固定线程池（5 生产者 + 10 消费者）
        ExecutorService service = Executors.newFixedThreadPool(15);

        // 启动 5 个生产者线程，传入共享 list、最大容量、以及锁对象
        for (int i = 0; i < 5; i++) {
            service.submit(new Productor(linkedList, 8, lock));
        }

        // 启动 10 个消费者线程，传入共享 list 和锁
        for (int i = 0; i < 10; i++) {
            service.submit(new Consumer(linkedList, lock));
        }

        // ⚠️ 注意：未调用 shutdown()，程序将无限运行
    }

    // ========== 生产者类 ==========
    static class Productor implements Runnable {

        private List<Integer> list;      // 共享缓冲区
        private int maxLength;           // 缓冲区最大容量
        private Lock lock;               // 共享锁对象

        public Productor(List<Integer> list, int maxLength, Lock lock) {
            this.list = list;
            this.maxLength = maxLength;
            this.lock = lock;
        }

        @Override
        public void run() {
            while (true) {
                // 【关键1】获取锁（类似进入 synchronized 块）
                lock.lock();
                try {
                    // 【关键2】使用 while 循环检查条件（防止虚假唤醒）
                    while (list.size() == maxLength) {
                        System.out.println("生产者" + Thread.currentThread().getName() + "  list已达最大容量，进行wait");
                        // 【关键3】在 'full' 条件上等待 → 释放锁并挂起
                        full.await(); // 相当于 synchronized 中的 list.wait()
                        System.out.println("生产者" + Thread.currentThread().getName() + "  退出wait");
                    }

                    // 生成随机数据
                    Random random = new Random();
                    int i = random.nextInt();
                    System.out.println("生产者" + Thread.currentThread().getName() + " 生产数据 " + i);
                    list.add(i);

                    // 【关键4】通知所有在 'empty' 条件上等待的消费者（因为现在有数据了！）
                    empty.signalAll(); // 相当于 list.notifyAll()，但只唤醒消费者

                } catch (InterruptedException e) {
                    e.printStackTrace();
                } finally {
                    // 【关键5】必须在 finally 中释放锁（确保即使异常也能解锁）
                    lock.unlock();
                }
            }
        }
    }

    // ========== 消费者类 ==========
    static class Consumer implements Runnable {

        private List<Integer> list; // 共享缓冲区
        private Lock lock;          // 共享锁对象

        public Consumer(List<Integer> list, Lock lock) {
            this.list = list;
            this.lock = lock;
        }

        @Override
        public void run() {
            while (true) {
                // 【关键6】获取锁
                lock.lock();
                try {
                    // 【关键7】检查缓冲区是否为空
                    while (list.isEmpty()) {
                        System.out.println("消费者" + Thread.currentThread().getName() + "  list为空，进行wait");
                        // 【关键8】在 'empty' 条件上等待
                        empty.await(); // 释放锁，等待生产者唤醒
                        System.out.println("消费者" + Thread.currentThread().getName() + "  退出wait");
                    }

                    // 消费数据（FIFO）
                    Integer element = list.remove(0);
                    System.out.println("消费者" + Thread.currentThread().getName() + "  消费数据：" + element);

                    // 【关键9】通知所有在 'full' 条件上等待的生产者（因为腾出空间了！）
                    full.signalAll(); // 唤醒生产者

                } catch (InterruptedException e) {
                    e.printStackTrace();
                } finally {
                    // 【关键10】释放锁
                    lock.unlock();
                }
            }
        }
    }
}
```

<img src="/juc-img/image-20260118174853009.png" alt="image-20260118174853009" style="zoom:50%;" />

#### BlockingQueue 实现生产者-消费者

BlockingQueue 提供了可阻塞的插入和移除的方法。当队列容器已满，生产者线程会被阻塞，直到队列未满；当队列容器为空时，消费者线程会被阻塞，直至队列非空时为止。

![img](/juc-img/shengchanzhe-xiaofeizhe-20230825160139.png)

有了这个队列，生产者就只需要关注生产，而不用管消费者的消费行为，更不用等待消费者线程执行完；消费者也只管消费，不用管生产者是怎么生产的，更不用等着生产者生产。

```java
public class ProductorConsumer {

    // 🧺 共享的阻塞队列（线程安全，内部已处理同步与等待）
    // 默认无界（但可指定容量），这里未设上限 → 理论上不会阻塞生产者（除非内存耗尽）
    private static LinkedBlockingQueue<Integer> queue = new LinkedBlockingQueue<>();

    public static void main(String[] args) {
        // 创建固定大小线程池（5 生产者 + 10 消费者）
        ExecutorService service = Executors.newFixedThreadPool(15);

        // 启动 5 个生产者
        for (int i = 0; i < 5; i++) {
            service.submit(new Productor(queue));
        }

        // 启动 10 个消费者
        for (int i = 0; i < 10; i++) {
            service.submit(new Consumer(queue));
        }

        // ⚠️ 注意：程序将无限运行（因 while(true)），需手动 Ctrl+C 停止
    }

    // ========== 生产者类 ==========
    static class Productor implements Runnable {

        private BlockingQueue<Integer> queue; // 泛型更安全（建议）

        public Productor(BlockingQueue<Integer> queue) {
            this.queue = queue;
        }

        @Override
        public void run() {
            try {
                while (true) {
                    // 生成随机数据
                    Random random = new Random();
                    int data = random.nextInt();
                    System.out.println("生产者" + Thread.currentThread().getName() + " 生产数据 " + data);

                    // 【关键】将数据放入队列
                    // 若队列有界且已满，put() 会自动阻塞当前线程，直到有空间
                    queue.put(data); // 内部已加锁 + wait/notify，无需手动同步

                    // 可选：加一点延迟便于观察（非必须）
                    // Thread.sleep(100);
                }
            } catch (InterruptedException e) {
                // 被中断时退出（例如调用 thread.interrupt()）
                System.out.println("生产者 " + Thread.currentThread().getName() + " 被中断");
                Thread.currentThread().interrupt(); // 推荐恢复中断状态
            }
        }
    }

    // ========== 消费者类 ==========
    static class Consumer implements Runnable {

        private BlockingQueue<Integer> queue;

        public Consumer(BlockingQueue<Integer> queue) {
            this.queue = queue;
        }

        @Override
        public void run() {
            try {
                while (true) {
                    // 【关键】从队列取出数据
                    // 若队列为空，take() 会自动阻塞当前线程，直到有数据
                    Integer element = queue.take(); // 阻塞式获取

                    System.out.println("消费者" + Thread.currentThread().getName() + " 正在消费数据 " + element);
                }
            } catch (InterruptedException e) {
                System.out.println("消费者 " + Thread.currentThread().getName() + " 被中断");
                Thread.currentThread().interrupt();
            }
        }
    }
}
```

输出结果：

```java
消费者pool-1-thread-7正在消费数据1520577501
生产者pool-1-thread-4生产数据-127809610
消费者pool-1-thread-8正在消费数据504316513
生产者pool-1-thread-2生产数据1994678907
消费者pool-1-thread-11正在消费数据1967302829
生产者pool-1-thread-1生产数据369331507
消费者pool-1-thread-9正在消费数据1994678907
生产者pool-1-thread-2生产数据-919544017
消费者pool-1-thread-12正在消费数据-127809610
生产者pool-1-thread-4生产数据1475197572
消费者pool-1-thread-14正在消费数据-893487914
生产者pool-1-thread-3生产数据906921688
消费者pool-1-thread-6正在消费数据-1292015016
生产者pool-1-thread-5生产数据-652105379
生产者pool-1-thread-5生产数据-1622505717
生产者pool-1-thread-3生产数据-1350268764
消费者pool-1-thread-7正在消费数据906921688
生产者pool-1-thread-4生产数据2091628867
消费者pool-1-thread-13正在消费数据1475197572
消费者pool-1-thread-15正在消费数据-919544017
生产者pool-1-thread-2生产数据564860122
生产者pool-1-thread-2生产数据822954707
消费者pool-1-thread-14正在消费数据564860122
消费者pool-1-thread-10正在消费数据369331507
生产者pool-1-thread-1生产数据-245820912
消费者pool-1-thread-6正在消费数据822954707
生产者pool-1-thread-2生产数据1724595968
生产者pool-1-thread-2生产数据-1151855115
消费者pool-1-thread-12正在消费数据2091628867
生产者pool-1-thread-4生产数据-1774364499
生产者pool-1-thread-4生产数据2006106757
消费者pool-1-thread-14正在消费数据-1774364499
生产者pool-1-thread-3生产数据-1070853639
消费者pool-1-thread-9正在消费数据-1350268764
消费者pool-1-thread-11正在消费数据-1622505717
生产者pool-1-thread-5生产数据355412953
```

可以看出，使用 BlockingQueue 来实现生产者-消费者很简洁，这正是 BlockingQueue 的优势所在。

#### 生产者-消费者模式的应用场景

**1、Excutor 任务执行框架**

通过将任务的提交和任务的执行解耦开来，提交任务的操作相当于生产者，执行任务的操作相当于消费者。

例如使用 Excutor 构建 Web 服务器，用于处理线程的请求：生产者将任务提交给线程池，线程池创建线程处理任务，如果需要运行的任务数大于线程池的基本线程数，那么就把任务扔到阻塞队列（通过线程池+阻塞队列的方式比只使用一个阻塞队列的效率高很多，因为消费者能够处理就直接处理掉了，不用每个消费者都要先从阻塞队列中取出任务再执行）

**2、消息中间件 MQ**

双十一的时候，会产生大量的订单，那么不可能同时处理那么多的订单，需要将订单放入一个队列里面，然后由专门的线程处理订单。

这里用户下单就是生产者，处理订单的线程就是消费者；再比如 12306 的抢票功能，先由一个容器存储用户提交的订单，然后再由专门处理订单的线程慢慢处理，这样可以在短时间内支持高并发服务。

**3、任务的处理时间比较长的情况下**

比如上传附件并处理，那么这个时候可以将用户上传和处理附件分成两个过程，用一个队列暂时存储用户上传的附件，然后立刻返回用户上传成功，然后有专门的线程处理队列中的附件。

生产者-消费者模式的优点：

- 解耦：将生产者类和消费者类进行解耦，消除代码之间的依赖性，简化工作负载的管理
- 复用：通过将生产者类和消费者类独立开来，对生产者类和消费者类进行独立的复用与扩展
- 调整并发数：由于生产者和消费者的处理速度是不一样的，可以调整并发数，给予慢的一方多的并发数，来提高任务的处理速度
- 异步：对于生产者和消费者来说能够各司其职，生产者只需要关心缓冲区是否还有数据，不需要等待消费者处理完；对于消费者来说，也只需要关注缓冲区的内容，不需要关注生产者，通过异步的方式支持高并发，将一个耗时的流程拆成生产和消费两个阶段，这样生产者因为执行 put 的时间比较短，可以支持高并发
- 支持分布式：生产者和消费者通过队列进行通讯，所以不需要运行在同一台机器上，在分布式环境中可以通过 redis 的 list 作为队列，而消费者只需要轮询队列中是否有数据。同时还能支持集群的伸缩性，当某台机器宕掉的时候，不会导致整个集群宕掉
