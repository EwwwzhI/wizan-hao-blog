---
title: JUC 并发编程 3—JUC 核心组件与并发实践（一）
description: JUC Concurrent programming——JUC Core Components and Concurrency Practices
pubDate: 2026-03-03
lastModDate: ''
ogImage: false
toc: true
search: true
---

[【跳转到上一篇：JUC并发编程 2—Java内存模型与底层同步机制】](/blogs/juc并发编程/juc-并发编程-2java-内存模型与底层同步机制/)

[【跳转到下一篇：JUC 并发编程 4—JUC 核心组件与并发实践（二）】](/blogs/juc并发编程/juc-并发编程-4juc-核心组件与并发实践二/)

> “以上是 Java 并发的底层机制。从 Java 5 开始，JUC 提供了更强大、灵活、安全的并发工具，我们进入第二部分。”
>
> “JUC 的所有高级组件，要么基于 CAS（无锁），要么基于 AQS（有锁），而 AQS 本身又依赖 volatile 和 CAS。”

**JUC** 全称是 **java.util.concurrent**，在 JDK 1.5 中引入，提供了丰富的并发工具类，用于支持多线程和并发操作。主要包括以下几类内容：

![JUC](/juc-img/JUC-1767453791386-16.png)

## 九、原子类和原子操作（未整理）

`java.util.concurrent.atomic`（简称 **JUC atomic**）包提供了支持**无锁、线程安全**的原子操作类，主要基于 **CAS（Compare-And-Swap）** 机制实现，避免了使用 `synchronized` 或 `Lock` 的开销。该包中的类和接口可以分为以下几大类：

一、基本类型原子类（针对单一变量）

这些类对 Java 基本类型提供原子操作：

| 类名                 | 对应基本类型 | 主要功能                   |
| :------------------- | :----------- | :------------------------- |
| `AtomicBoolean`      | `boolean`    | 原子布尔值                 |
| `AtomicInteger`      | `int`        | 原子整型（最常用）         |
| `AtomicLong`         | `long`       | 原子长整型                 |
| `AtomicReference<V>` | 引用类型 `V` | 原子引用（可包装任意对象） |

> 所有类都支持：`get()`, `set()`, `compareAndSet(expect, update)`, `getAndSet(newValue)`, 以及 Java 8+ 新增的 `getAndUpdate()`, `updateAndGet()`, `getAndAccumulate()`, `accumulateAndGet()` 等高阶方法。

二、数组类型原子类（支持数组元素的原子更新）

用于对**数组中某个索引位置**进行原子操作：

| 类名                      | 说明                                |
| :------------------------ | :---------------------------------- |
| `AtomicIntegerArray`      | `int[]` 的原子操作封装              |
| `AtomicLongArray`         | `long[]` 的原子操作封装             |
| `AtomicReferenceArray<E>` | `E[]`（引用类型数组）的原子操作封装 |

> ⚠️ 注意：这些类**不会让整个数组线程安全**，而是保证**单个元素的更新是原子的**。

三、字段更新器（Atomic Field Updater）

用于对**普通对象的 volatile 字段**进行原子更新，避免为每个字段创建原子包装对象，节省内存。

| 类名                                | 适用字段类型                 |
| :---------------------------------- | :--------------------------- |
| `AtomicIntegerFieldUpdater<T>`      | `volatile int` 字段          |
| `AtomicLongFieldUpdater<T>`         | `volatile long` 字段         |
| `AtomicReferenceFieldUpdater<T, V>` | `volatile V`（引用类型）字段 |

> 使用时需通过反射指定字段名，并要求字段是 `volatile` 的。
> 示例：
>
> ```
> AtomicIntegerFieldUpdater<MyClass> updater =
>  AtomicIntegerFieldUpdater.newUpdater(MyClass.class, "counter");
> ```

四、增强型原子类（Java 8+ 引入，解决 ABA 问题或提升性能）

1.带版本戳的原子引用（解决 ABA 问题）

| 类名                         | 说明                                                         |
| :--------------------------- | :----------------------------------------------------------- |
| `AtomicStampedReference<V>`  | 通过引入 **stamp（版本号）** 解决 CAS 中的 ABA 问题          |
| `AtomicMarkableReference<V>` | 使用一个 **boolean 标记位**（而非整数版本）来辅助判断是否被修改过 |

> - `AtomicStampedReference` 常用于需要严格顺序一致性的场景（如并发栈/队列）。
> - `compareAndSet(expectedReference, newReference, expectedStamp, newStamp)`

2.高性能累加器（Java 8 引入）

适用于高并发下的**计数、累加**场景，比 `AtomicLong` 性能更高（采用分段缓存 + 最终合并策略，类似 `LongAdder`）：

| 类名                | 用途                                                      |
| :------------------ | :-------------------------------------------------------- |
| `LongAdder`         | 高并发下的 `long` 累加（如计数器）                        |
| `DoubleAdder`       | 高并发下的 `double` 累加                                  |
| `LongAccumulator`   | 支持自定义累积函数的 `long` 累加器（如 max、min、sum 等） |
| `DoubleAccumulator` | 支持自定义累积函数的 `double` 累加器                      |

> 特点：**写多读少**场景下性能远优于 `AtomicLong`，但 `sum()`（或 `doubleValue()`）结果是**最终一致**，非实时精确（除非无并发）。

**总结分类表**

| 类别             | 类/工具                                                      |
| :--------------- | :----------------------------------------------------------- |
| **基本类型**     | `AtomicBoolean`, `AtomicInteger`, `AtomicLong`, `AtomicReference` |
| **数组类型**     | `AtomicIntegerArray`, `AtomicLongArray`, `AtomicReferenceArray` |
| **字段更新器**   | `AtomicXXXFieldUpdater`                                      |
| **ABA 解决方案** | `AtomicStampedReference`, `AtomicMarkableReference`          |
| **高性能累加器** | `LongAdder`, `DoubleAdder`, `LongAccumulator`, `DoubleAccumulator` |

**使用建议**

- 普通原子操作 → 用 `AtomicInteger` / `AtomicReference`
- 高并发计数 → 用 `LongAdder`
- 需要避免 ABA 问题 → 用 `AtomicStampedReference`
- 更新对象内部字段 → 用 `FieldUpdater`
- 处理数组元素原子更新 → 用 `AtomicXXXArray`

- AtomicInteger / AtomicLong / AtomicReference
- AtomicStampedReference（解决 ABA）
- LongAdder / DoubleAdder（高并发计数优化）

JUC为我们提供了原子类，底层采用CAS算法，它是一种用法简单、性能高效、线程安全地更新变量的方式。

### 原子类介绍

常用基本数据类，有对应的原子类封装：

* AtomicInteger：原子更新int
* AtomicLong：原子更新long
* AtomicBoolean：原子更新boolean

那么，原子类和普通的基本类在使用上有没有什么区别呢？我们先来看正常情况下使用一个基本类型：

```java
public class Main {
    public static void main(String[] args) {
        int i = 1;
        System.out.println(i++);
    }
}
```

现在我们使用int类型对应的原子类，要实现同样的代码该如何编写：

```java
public class Main {
    public static void main(String[] args) {
        AtomicInteger i = new AtomicInteger(1);
        System.out.println(i.getAndIncrement());  //如果想实现i += 2这种操作，可以使用 addAndGet() 自由设置delta 值
    }
}
```

我们可以将int数值封装到此类中（注意必须调用构造方法，它不像Integer那样有装箱机制），并且通过调用此类提供的方法来获取或是对封装的int值进行自增，乍一看，这不就是基本类型包装类嘛，有啥高级的。确实，还真有包装类那味，但是它可不仅仅是简单的包装，它的自增操作是具有原子性的：

```java
public class Main {
    private static AtomicInteger i = new AtomicInteger(0);
    public static void main(String[] args) throws InterruptedException {
        Runnable r = () -> {
            for (int j = 0; j < 100000; j++)
                i.getAndIncrement();
            System.out.println("自增完成！");
        };
        new Thread(r).start();
        new Thread(r).start();
        TimeUnit.SECONDS.sleep(1);
        System.out.println(i.get());
    }
}
```

同样是直接进行自增操作，我们发现，使用原子类是可以保证自增操作原子性的，就跟我们前面加锁一样。怎么会这么神奇？我们来看看它的底层是如何实现的，直接从构造方法点进去：

```java
private volatile int value;

public AtomicInteger(int initialValue) {
    value = initialValue;
}

public AtomicInteger() {
}
```

可以看到，它的底层是比较简单的，其实本质上就是封装了一个`volatile`类型的int值，这样能够保证可见性，在CAS操作的时候不会出现问题。

```java
private static final Unsafe unsafe = Unsafe.getUnsafe();
private static final long valueOffset;

static {
    try {
        valueOffset = unsafe.objectFieldOffset
            (AtomicInteger.class.getDeclaredField("value"));
    } catch (Exception ex) { throw new Error(ex); }
}
```

可以看到最上面是和AQS采用了类似的机制，因为要使用CAS算法更新value的值，所以得先计算出value字段在对象中的偏移地址，CAS直接修改对应位置的内存即可（可见Unsafe类的作用巨大，很多的底层操作都要靠它来完成）

接着我们来看自增操作是怎么在运行的：

```java
public final int getAndIncrement() {
    return unsafe.getAndAddInt(this, valueOffset, 1);
}
```

可以看到这里调用了`unsafe.getAndAddInt()`，套娃时间到，我们接着看看Unsafe里面写了什么：

```java
public final int getAndAddInt(Object o, long offset, int delta) {  //delta就是变化的值，++操作就是自增1
    int v;
    do {
      	//volatile版本的getInt()
      	//能够保证可见性
        v = getIntVolatile(o, offset);
    } while (!compareAndSwapInt(o, offset, v, v + delta));  //这里是开始cas替换int的值，每次都去拿最新的值去进行替换，如果成功则离开循环，不成功说明这个时候其他线程先修改了值，就进下一次循环再获取最新的值然后再cas一次，直到成功为止
    return v;
}
```

可以看到这是一个`do-while`循环，那么这个循环在做一个什么事情呢？感觉就和我们之前讲解的AQS队列中的机制差不多，也是采用自旋形式，来不断进行CAS操作，直到成功。

![image-20230306171720896](/juc-img/JL3ZjbmwFW67tOM.png)

可见，原子类底层也是采用了CAS算法来保证的原子性，包括`getAndSet`、`getAndAdd`等方法都是这样。原子类也直接提供了CAS操作方法，我们可以直接使用：

```java
public static void main(String[] args) throws InterruptedException {
    AtomicInteger integer = new AtomicInteger(10);
    System.out.println(integer.compareAndSet(30, 20));
    System.out.println(integer.compareAndSet(10, 20));
    System.out.println(integer);
}
```

如果想以普通变量的方式来设定值，那么可以使用`lazySet()`方法，这样就不采用`volatile`的立即可见机制了。

```java
AtomicInteger integer = new AtomicInteger(1);
integer.lazySet(2);
```

除了基本类有原子类以外，基本类型的数组类型也有原子类：

* AtomicIntegerArray：原子更新int数组
* AtomicLongArray：原子更新long数组
* AtomicReferenceArray：原子更新引用数组

其实原子数组和原子类型一样的，不过我们可以对数组内的元素进行原子操作：

```java
public static void main(String[] args) throws InterruptedException {
    AtomicIntegerArray array = new AtomicIntegerArray(new int[]{0, 4, 1, 3, 5});
    Runnable r = () -> {
        for (int i = 0; i < 100000; i++)
            array.getAndAdd(0, 1);
    };
    new Thread(r).start();
    new Thread(r).start();
    TimeUnit.SECONDS.sleep(1);
    System.out.println(array.get(0));
}
```

在JDK8之后，新增了`DoubleAdder`和`LongAdder`，在高并发情况下，`LongAdder`的性能比`AtomicLong`的性能更好，主要体现在自增上，它的大致原理如下：在低并发情况下，和`AtomicLong`是一样的，对value值进行CAS操作，但是出现高并发的情况时，`AtomicLong`会进行大量的循环操作来保证同步，而`LongAdder`会将对value值的CAS操作分散为对数组`cells`中多个元素的CAS操作（内部维护一个Cell[] as数组，每个Cell里面有一个初始值为0的long型变量，在高并发时会进行分散CAS，就是不同的线程可以对数组中不同的元素进行CAS自增，这样就避免了所有线程都对同一个值进行CAS），只需要最后再将结果加起来即可。

![image-20230306171732740](/juc-img/KksGxhMYABe7nED.png)

使用如下：

```java
public static void main(String[] args) throws InterruptedException {
    LongAdder adder = new LongAdder();
    Runnable r = () -> {
        for (int i = 0; i < 100000; i++)
            adder.add(1);
    };
    for (int i = 0; i < 100; i++)
        new Thread(r).start();   //100个线程
    TimeUnit.SECONDS.sleep(1);
    System.out.println(adder.sum());   //最后求和即可
}
```

由于底层源码比较复杂，这里就不做讲解了。两者的性能对比（这里用到了CountDownLatch，建议学完之后再来看）：

```java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        System.out.println("使用AtomicLong的时间消耗："+test2()+"ms");
        System.out.println("使用LongAdder的时间消耗："+test1()+"ms");
    }

    private static long test1() throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(100);
        LongAdder adder = new LongAdder();
        long timeStart = System.currentTimeMillis();
        Runnable r = () -> {
            for (int i = 0; i < 100000; i++)
                adder.add(1);
            latch.countDown();
        };
        for (int i = 0; i < 100; i++)
            new Thread(r).start();
        latch.await();
        return System.currentTimeMillis() - timeStart;
    }

    private static long test2() throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(100);
        AtomicLong atomicLong = new AtomicLong();
        long timeStart = System.currentTimeMillis();
        Runnable r = () -> {
            for (int i = 0; i < 100000; i++)
                atomicLong.incrementAndGet();
            latch.countDown();
        };
        for (int i = 0; i < 100; i++)
            new Thread(r).start();
        latch.await();
        return System.currentTimeMillis() - timeStart;
    }
}
```

除了对基本数据类型支持原子操作外，对于引用类型，也是可以实现原子操作的：

```java
public static void main(String[] args) throws InterruptedException {
    String a = "Hello";
    String b = "World";
    AtomicReference<String> reference = new AtomicReference<>(a);
    reference.compareAndSet(a, b);
    System.out.println(reference.get());
}
```

JUC还提供了字段原子更新器，可以对类中的某个指定字段进行原子操作（注意字段必须添加volatile关键字）：

```java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        Student student = new Student();
        AtomicIntegerFieldUpdater<Student> fieldUpdater =
                AtomicIntegerFieldUpdater.newUpdater(Student.class, "age");
        System.out.println(fieldUpdater.incrementAndGet(student));
    }

    public static class Student{
        volatile int age;
    }
}
```

#### FutureTask 的“一次性执行”语义（run-once semantics）

> **是的，即使在高并发环境下，`FutureTask` 能确保其封装的任务（`Callable` 或 `Runnable`）最多只被执行一次。**

这是由 `FutureTask` **内部状态机 + CAS 原子操作** 保证的，是线程安全的。

1、为什么需要这个保证？

想象一个常见场景：**缓存加载（Cache Loading）**

```
ConcurrentMap<String, Future<String>> cache = new ConcurrentHashMap<>();

public String getValue(String key) throws Exception {
    Future<String> f = cache.get(key);
    if (f != null) {
        return f.get(); // 多个线程可能同时走到这里
    }

    Callable<String> task = () -> expensiveCompute(key); // 耗时计算
    FutureTask<String> ft = new FutureTask<>(task);
    
    // 尝试放入缓存（可能多个线程同时创建 ft）
    f = cache.putIfAbsent(key, ft);
    if (f == null) {
        f = ft;
        ft.run(); // 只有 putIfAbsent 成功的线程才执行？
    }
    return f.get();
}
```

⚠️ **问题**：
 如果有多个线程同时发现 `cache` 中没有 `key`，它们都会创建自己的 `FutureTask` 实例，并尝试 `putIfAbsent`。
 但最终**只有一个 `FutureTask` 会留在缓存中**，其他线程拿到的是这个“胜出”的 `ft`。

那么：

- **胜出的 `ft` 会被执行多次吗？**
- **失败的 `ft` 会被执行吗？**

答案是：**都不会！**

2、`FutureTask` 如何保证任务只执行一次？

1. **内部状态机（State Machine）**

`FutureTask` 内部有一个 `volatile int state` 字段，表示当前状态：

```java
/**
    *
    * state可能的状态转变路径如下：
    * NEW -> COMPLETING -> NORMAL
    * NEW -> COMPLETING -> EXCEPTIONAL
    * NEW -> CANCELLED
    * NEW -> INTERRUPTING -> INTERRUPTED
    */
private volatile int state;
private static final int NEW = 0;
private static final int COMPLETING = 1;
private static final int NORMAL = 2;
private static final int EXCEPTIONAL = 3;
private static final int CANCELLED = 4;
private static final int INTERRUPTING = 5;
private static final int INTERRUPTED = 6;
```

state表示任务的运行状态，初始状态为NEW。运行状态只会在set、
setException、cancel方法中终止。COMPLETING、INTERRUPTING是任务完成后的瞬时状态。

2. **`run()` 方法的关键逻辑（简化版）**

```
public void run() {
    // 1. 如果不是 NEW 状态，直接返回（不执行！）
    if (state != NEW || !UNSAFE.compareAndSwapObject(this, runnerOffset, null, Thread.currentThread()))
        return;

    try {
        Callable<V> c = callable;
        if (c != null && state == NEW) {
            V result;
            boolean ran;
            try {
                result = c.call(); // 执行任务！
                ran = true;
            } catch (Throwable ex) {
                result = null;
                ran = false;
                setException(ex);
            }
            if (ran)
                set(result); // 设置结果，更新 state → NORMAL
        }
    } finally {
        runner = null;
        // 处理中断等...
    }
}
```

关键保护点：

- **只有当 `state == NEW` 时才会执行 `call()`**
- **执行前通过 CAS 设置 `runner` 线程**，防止多个线程同时进入
- **一旦任务开始执行或完成，`state` 就不再是 `NEW`**
- **后续任何线程再调用 `run()`，都会因 `state != NEW` 而直接返回**

> 🛡️ 即使多个线程**同时调用同一个 `FutureTask` 实例的 `run()` 方法**，也**只有一个线程能真正执行 `call()`**，其他线程会立即退出。

3、回到缓存例子：为什么安全？

```
FutureTask<String> ft = new FutureTask<>(task);
f = cache.putIfAbsent(key, ft);
if (f == null) {
    f = ft;
    ft.run(); // ← 只有 putIfAbsent 成功的线程才调用 run()
}
return f.get();
```

- **情况1**：线程 A 成功 `putIfAbsent`，拿到 `null`，于是调用 `ftA.run()` → 任务执行。
- **情况2**：线程 B 失败，`putIfAbsent` 返回 `ftA`，于是它调用 `ftA.get()`。
  - 此时 `ftA` 可能正在执行，也可能已完成。
  - 但 **线程 B 不会调用 `ftB.run()`**（因为它没进 `if (f == null)` 分支）。
  - 所以 `ftB` **根本不会被执行**！

> 💡 即使不小心让多个线程都调用了 `run()`（比如错误地共享了同一个 `FutureTask`），`FutureTask` 的内部状态机也会确保 `call()` 只执行一次。

4、注意：每个 `FutureTask` 实例独立

- `FutureTask` 的“只执行一次”是**针对单个实例**的。
- 如果你创建了 **两个不同的 `FutureTask` 实例**（即使包装同一个 `Callable`），它们会**各自执行一次**。

```
Callable<Integer> task = () -> { System.out.println("Run!"); return 1; };

FutureTask<Integer> ft1 = new FutureTask<>(task);
FutureTask<Integer> ft2 = new FutureTask<>(task);

ft1.run(); // 打印 "Run!"
ft2.run(); // 再次打印 "Run!" —— 这是两个独立任务！
```

所以在缓存模式中，必须确保**所有线程共享同一个 `FutureTask` 实例**（通过 `ConcurrentHashMap.putIfAbsent` 实现）。

5、总结

| 问题                                  | 答案                                                        |
| ------------------------------------- | ----------------------------------------------------------- |
| `FutureTask` 能否确保任务只执行一次？ | **能！**（对同一个实例）                                    |
| 如何实现的？                          | **内部状态机 + CAS 原子操作**，只有 `state == NEW` 时才执行 |
| 高并发下安全吗？                      | **安全！** 多线程同时调用 `run()` 也不会重复执行            |
| 多个 `FutureTask` 实例呢？            | **各自独立**，会分别执行（所以缓存中要共享同一个实例）      |

这种“一次性执行”语义，使得 `FutureTask` 成为实现 **线程安全的延迟初始化（Lazy Initialization）** 和 **缓存加载** 的理想工具。

这也是为什么像 Guava Cache、Caffeine 等高性能缓存库，在内部都利用了类似的 `Future` 包装机制。

## 十、显式锁与条件等待

`synchronized` 的不足之处：

- 如果临界区是只读操作，其实可以多线程一起执行，但使用 synchronized 的话，**同一时间只能有一个线程执行**。
- synchronized 无法知道线程有没有成功获取到锁。
- 使用 synchronized，如果临界区因为 IO 或者 sleep 方法等原因阻塞了，而当前线程又没有释放锁，就会导致**所有线程等待**。

JUC 包下的 `locks` 子包（即 `java.util.concurrent.locks`）提供了一组比内置的 `synchronized` 更灵活、功能更强大的锁机制。

**一、核心接口**

1. **`Lock`**
   - 最核心的锁接口，定义了基本的加锁/解锁操作。
   - 获取锁和释放锁的方法：`lock()`, `unlock()`, `tryLock()`, `tryLock(long, TimeUnit)`, `lockInterruptibly()`, `newCondition()`。
2. **`ReadWriteLock`**
   - 定义读写锁的接口，支持多个读线程同时访问，但写线程独占。
   - 只有两个方法：`readLock()`, `writeLock()`，分别返回 `Lock` 类型的读锁和写锁。
3. **`Condition`**（与 `Lock` 配合使用）
   - 类似于 `Object` 的 `wait/notify` 机制，但与 `Lock` 绑定，支持更细粒度的线程等待/通知。
   - 方法如：`await()`, `signal()`, `signalAll()` 等。

**二、主要实现类**

1. **`ReentrantLock`**
   - `Lock` 接口的可重入互斥锁实现。
   - 是 `synchronized` 的替代品，功能更强大（如可中断、超时、尝试获取锁等）。
2. **`ReentrantReadWriteLock`**
   - `ReadWriteLock` 接口的实现，内部包含一个 `ReadLock` 和一个 `WriteLock`。
   - 读锁可重入、共享；写锁可重入、独占。
3. **`StampedLock`**（Java 8 引入）
   - 比 `ReentrantReadWriteLock` 性能更高，支持**乐观读**（optimistic reading）。
   - 不是 `ReadWriteLock` 的实现，而是一个独立的高性能读写锁。
   - 提供三种模式：写（exclusive）、读（shared）、乐观读（optimistic read）。
   - 注意：**不可重入**，且不支持 `Condition`。

**三、其他辅助类 / 抽象类**

1. **`AbstractQueuedSynchronizer`（AQS）、`AbstractQueuedLongSynchronizer`（AQLS）**

   > [!NOTE]
   >
   > 当同步状态（`state`）需要超过 `int` 范围（例如某些高精度资源计数、大容量信号量等）时，使用 `long` 类型的 `state`。

   - 虽然不是直接用于用户代码，但它是 JUC 中几乎所有同步器（如 `ReentrantLock`, `CountDownLatch`, `Semaphore` 等）的基础框架。
   - `ReentrantLock` 等内部通过继承 AQS 实现同步状态管理。

2. **`AbstractOwnableSynchronizer`**

   ```java
   // 独占模式，锁的持有者
   private transient Thread exclusiveOwnerThread;
   
   // 设置锁持有者
   protected final void setExclusiveOwnerThread(Thread t) {
       exclusiveOwnerThread = t;
   }
   
   // 获取锁的持有线程
   protected final Thread getExclusiveOwnerThread() {
       return exclusiveOwnerThread;
   }
   ```

   - AQS、AQLS 的父类，提供记录当前独占锁持有线程的能力。

3. **`LockSupport`**

   - 提供底层线程阻塞/唤醒操作（`park()` / `unpark()`），是 AQS 的基础工具。
   - 不是锁，但被锁实现广泛使用。

### 锁分类

<img src="/juc-img/other-bukfsdjavassmtjstd-b2ded433-defd-4535-b767-fd2e5be0b5b9.png" alt="other-bukfsdjavassmtjstd-b2ded433-defd-4535-b767-fd2e5be0b5b9" style="zoom:50%;" />

### Lock和Condition接口

使用并发包中的锁和传统的 `synchronized` 锁不太一样，这里的锁我们可以认为是一把真正意义上的锁，每个锁都是一个对应的锁对象，只需要向锁对象获取锁或是释放锁即可。

```java
public interface Lock {
    //获取锁，拿不到锁会阻塞，等待其他线程释放锁，获取到锁后返回
    void lock();
    //同上，但是等待过程中会响应中断
    void lockInterruptibly() throws InterruptedException;
    //尝试获取锁，但是不会阻塞，如果能获取到会返回true，不能返回false
    boolean tryLock();
    //尝试获取锁，但是可以限定超时时间，如果超出时间还没拿到锁返回false，否则返回true，可以响应中断
    boolean tryLock(long time, TimeUnit unit) throws InterruptedException;
    //释放锁
    void unlock();
    //暂时可以理解为替代传统的Object的wait()、notify()等操作的工具
    Condition newCondition();
}
```

示例：

```java
public class Main {
    private static int i = 0;
    public static void main(String[] args) throws InterruptedException {
        Lock testLock = new ReentrantLock();
        Runnable action = () -> {
            for (int j = 0; j < 100000; j++) {   //还是以自增操作为例
                testLock.lock();    //加锁，加锁成功后其他线程如果也要获取锁，会阻塞，等待当前线程释放
                i++;
                testLock.unlock();  //解锁，释放锁之后其他线程就可以获取这把锁了（注意在这之前一定得加锁，不然报错）
            }
        };
        new Thread(action).start();
        new Thread(action).start();
        Thread.sleep(1000);   //等上面两个线程跑完
        System.out.println(i);
    }
}
```

那么如何像传统的加锁那样，调用对象的 `wait()` 和 `notify()` 方法呢，并发包提供了 Condition 接口：

| 对比项                                         | Object 监视器                    | Condition                                                    |
| ---------------------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| 前置条件                                       | 获取对象的锁                     | 调用 Lock.lock 获取锁，调用 Lock.newCondition 获取 Condition 对象 |
| 调用方式                                       | 直接调用，比如 `object.notify()` | 直接调用，比如 `condition.await()`                           |
| 等待队列的个数                                 | 一个                             | 多个                                                         |
| 当前线程释放锁进入等待状态                     | 支持                             | 支持                                                         |
| 当前线程释放锁进入等待状态，在等待状态中不中断 | 不支持                           | 支持                                                         |
| 当前线程释放锁并进入超时等待状态               | 支持                             | 支持                                                         |
| 当前线程释放锁并进入等待状态直到将来的某个时间 | 不支持                           | 支持                                                         |
| 唤醒等待队列中的一个线程                       | 支持                             | 支持                                                         |
| 唤醒等待队列中的全部线程                       | 支持                             | 支持                                                         |

```java
public interface Condition {
  	//当前线程进入等待状态直到被通知（signal）或者中断；当前线程进入运行状态并从 await()方法返回的场景包括：（1）其他线程调用相同 Condition 对象的 signal/signalAll 方法，并且当前线程被唤醒；（2）其他线程调用 interrupt 方法中断当前线程；
 	  void await() throws InterruptedException;
  	//当前线程进入等待状态直到被通知，在此过程中对中断信号不敏感，不支持中断当前线程
  	void awaitUninterruptibly();
  	//当前线程进入等待状态，直到被通知、中断或者超时（纳秒）。如果返回值小于等于 0，可以认定就是超时了
  	long awaitNanos(long nanosTimeout) throws InterruptedException;
  	//同上但是可以指定时间单位，如果等待时间内被唤醒，返回true，否则返回false
  	boolean await(long time, TimeUnit unit) throws InterruptedException;
  	//当前线程进入等待状态，直到被通知、中断或者超时。如果没到指定时间被通知，则返回 true，否则返回 false
  	boolean awaitUntil(Date deadline) throws InterruptedException;
  	//唤醒一个等待在 Condition 上的线程，能够从 await()等方法返回的线程必须先获得与 Condition 对象关联的锁
  	void signal();
  	//唤醒所有等待在 Condition 上的线程，能够从 await()等方法返回的线程必须先获得与 Condition 对象关联的锁
  	void signalAll();
}
```

在调用Lock接口定义的 `newCondition()` 后，会生成一个AQS内部类ConditionObject的对象，具体底层原理见[条件队列ConditionObject](#条件队列)

```java
public static void main(String[] args) throws InterruptedException {
    Lock testLock = new ReentrantLock();
    Condition condition = testLock.newCondition();
    new Thread(() -> {
        testLock.lock();   //和synchronized一样，必须持有锁的情况下才能使用await
        System.out.println("线程1进入等待状态！");
        try {
            condition.await();   //进入等待状态
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println("线程1等待结束！");
        testLock.unlock();
    }).start();
    Thread.sleep(100); //防止线程2先跑
    new Thread(() -> {
        testLock.lock();
        System.out.println("线程2开始唤醒其他等待线程");
        condition.signal();   //唤醒线程1，但是此时线程1还必须要拿到锁才能继续运行
        System.out.println("线程2结束");
        testLock.unlock();   //这里释放锁之后，线程1就可以拿到锁继续运行了
    }).start();
}
```

并且同一把锁内是可以存在多个Condition对象的（原始的锁机制等待队列只能有一个，而这里可以创建很多个Condition来实现多等待队列），只有对同一个Condition对象进行等待和唤醒操作才会有效。

```java
public class BoundedBuffer<T> {
    private final LinkedList<T> buffer;  // 使用 LinkedList 作为缓冲区
    private final int capacity;          // 缓冲区最大容量
    private final ReentrantLock lock;    // 互斥锁
    private final Condition notEmpty;    // 缓冲区非空条件
    private final Condition notFull;     // 缓冲区非满条件

    public BoundedBuffer(int capacity) {
        this.capacity = capacity;
        this.buffer = new LinkedList<>();
        this.lock = new ReentrantLock();
        this.notEmpty = lock.newCondition();
        this.notFull = lock.newCondition();
    }

    // 放入一个元素
    public void put(T item) throws InterruptedException {
        lock.lock();
        try {
            // 如果缓冲区满，等待
            while (buffer.size() == capacity) {
                notFull.await();
            }
            buffer.add(item);
            // 通知可能正在等待的消费者
            notEmpty.signal();
        } finally {
            lock.unlock();
        }
    }

    // 取出一个元素
    public T take() throws InterruptedException {
        lock.lock();
        try {
            // 如果缓冲区空，等待
            while (buffer.isEmpty()) {
                notEmpty.await();
            }
            T item = buffer.removeFirst();
            // 通知可能正在等待的生产者
            notFull.signal();
            return item;
        } finally {
            lock.unlock();
        }
    }
}
```

考虑这个简单的有界缓冲区 BoundedBuffer，其中生产者放入元素，消费者取出元素。使用两个 Condition：一个表示缓冲区不为空（用于消费者等待），另一个表示缓冲区不满（用于生产者等待）。

生产者调用 put 方法放入元素，如果缓冲区已满，则等待 notFull 条件。消费者调用 take 方法取出元素，如果缓冲区为空，则等待 notEmpty 条件。当一个元素被放入或取出时，相应的条件会发出信号，唤醒等待的线程。

使用多个 Condition 对象的主要优点是为锁提供了更细粒度的控制，可以实现更复杂的同步场景，比如上面提到的有界缓冲区。

#### TimeUnit

位于 `java.util.concurrent` 包下的**枚举类时间单位**

```java
public enum TimeUnit {
    /**
     * Time unit representing one thousandth of a microsecond
     */
    NANOSECONDS {
        public long toNanos(long d)   { return d; }
        public long toMicros(long d)  { return d/(C1/C0); }
        public long toMillis(long d)  { return d/(C2/C0); }
        public long toSeconds(long d) { return d/(C3/C0); }
        public long toMinutes(long d) { return d/(C4/C0); }
        public long toHours(long d)   { return d/(C5/C0); }
        public long toDays(long d)    { return d/(C6/C0); }
        public long convert(long d, TimeUnit u) { return u.toNanos(d); }
        int excessNanos(long d, long m) { return (int)(d - (m*C2)); }
    },
    //....
```

可以看到时间单位有很多，比如 `DAY`、`SECONDS`、`MINUTES` 等，我们可以直接将其作为时间单位，比如要让一个线程等待3秒钟：

```java
public static void main(String[] args) throws InterruptedException {
    Lock testLock = new ReentrantLock();
    new Thread(() -> {
        testLock.lock();
        try {
            System.out.println("等待是否未超时："+testLock.newCondition().await(1, TimeUnit.SECONDS));
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        testLock.unlock();
    }).start();
}
```

TimeUnit 除了可以作为时间单位表示以外，还可以在不同单位之间相互转换：

```java
public static void main(String[] args) throws InterruptedException {
    System.out.println("60秒 = "+TimeUnit.SECONDS.toMinutes(60) +"分钟");
    System.out.println("365天 = "+TimeUnit.DAYS.toSeconds(365) +" 秒");
}
```

也可以更加便捷地使用对象的 `wait()` 方法：

```java
public static void main(String[] args) throws InterruptedException {
    synchronized (Main.class) {
        System.out.println("开始等待");
        TimeUnit.SECONDS.timedWait(Main.class, 3);   //直接等待3秒
        System.out.println("等待结束");
    }
}
```

也可以直接使用它来进行休眠操作：

```java
public static void main(String[] args) throws InterruptedException {
    TimeUnit.SECONDS.sleep(1);  //休眠1秒钟
}
```

### 可重入锁 ReentrantLock

| 功能                    | `synchronized`                             | `ReentrantLock`                                              |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| 可重入性                | 是                                         | 是                                                           |
| 公平锁支持              | 不支持（总是非公平）                       | 支持（构造时可选 `new ReentrantLock(true)`），保证多个等待锁的线程按照申请锁的顺序获得锁，避免线程饥饿现象 |
| 可中断等待              | 不可中断（只能等或死等）                   | 支持 `lockInterruptibly()`，可响应线程中断                   |
| 可以设置超时时间        | 不支持                                     | 支持 `tryLock(long timeout, TimeUnit unit)`                  |
| 尝试非阻塞获取锁        | 不支持                                     | 支持 `tryLock()`（立即返回成功/失败）                        |
| 多条件变量（Condition） | 只有一个隐式条件（`wait/notify`）          | 可创建并绑定多个 `Condition` 对象，实现精细的线程通信        |
| 锁信息查询              | 无法知道是否被持有、持有者、等待队列长度等 | 提供 `isLocked()`, `getHoldCount()`, `hasQueuedThreads()` 等方法 |
| 手动释放锁              | 自动释放（离开 synchronized 块）           | 必须手动 `unlock()`（需配合 `try-finally`）                  |

注意：使用 ReentrantLock 时，锁必须在 try 代码块开始之前获取，并且加锁之前不能有异常抛出，否则在 finally 块中就无法释放锁。

错误❎示例：

```java
Lock lock = new XxxLock();
// ...
try {
    // 如果在此抛出异常，会直接执行 finally 块的代码
    doSomething();
    // 不管锁是否成功，finally 块都会执行
    lock.lock();
    doOthers();

} finally {
    lock.unlock();
}
```

正确✅示例：

```java
Lock lock = new XxxLock();
// ...
lock.lock();
try {
    doSomething();
    doOthers();
} finally {
    lock.unlock();
}
```

#### 可重入

可重入是指一个线程如果首次获得了这把锁，那么因为它是锁的拥有者，因此有权利再次获得这把锁。

如果是不可重入锁，第二次获取锁时，自己也会被挡住。

```java
@Slf4j(topic = "c.TestReentrantLock")
public class Test {
    static ReentrantLock reentrantLock = new ReentrantLock();

    public static void main(String[] args) {
        method1();
    }

    public static void method1() {
        reentrantLock.lock();
        try {
            log.debug("execute method1");
            method2();
        } finally {
            reentrantLock.unlock();
        }
    }

    public static void method2() {
        reentrantLock.lock();
        try {
            log.debug("execute method2");
            method3();
        } finally {
            reentrantLock.unlock();
        }
    }

    public static void method3() {
        reentrantLock.lock();
        try {
            log.debug("execute method3");
        } finally {
            reentrantLock.unlock();
        }
    }
}
```

```bash
21:58:57.369 c.TestReentrantLock [main] - execute method1
21:58:57.373 c.TestReentrantLock [main] - execute method2
21:58:57.373 c.TestReentrantLock [main] - execute method3
```

#### 可打断

示例代码如下，先让主线程获取锁，然后启动t1线程，t1线程内也尝试获取锁，但由于此时锁的持有者是主线程，所以t1线程会阻塞等待，然后主线程执行打断

```java
@Slf4j(topic = "c.TestInterrupt")
public class Test {

    public static void main(String[] args) throws InterruptedException {
        ReentrantLock reentrantLock = new ReentrantLock();
        Thread t1 = new Thread(() -> {
            log.debug("启动");
            try {
                reentrantLock.lockInterruptibly();
            } catch (InterruptedException e) {
                e.printStackTrace();
                log.debug("等锁的过程中被打断了");
                return;
            }
            try {
                log.debug("获得了锁");
            } finally {
                reentrantLock.unlock();
            }
        }, "t1");

        reentrantLock.lock();
        log.debug("获得了锁");
        t1.start();
        try {
            Thread.sleep(1000);
            t1.interrupt();
            log.debug("执行打断");
        } finally {
            reentrantLock.unlock();
        }
    }
}
```

```bash
10:13:13.081 c.TestInterrupt [main] - 获得了锁
10:13:13.089 c.TestInterrupt [t1] - 启动
10:13:14.089 c.TestInterrupt [main] - 执行打断
10:13:14.090 c.TestInterrupt [t1] - 等锁的过程中被打断了
java.lang.InterruptedException
	at java.util.concurrent.locks.AbstractQueuedSynchronizer.doAcquireInterruptibly(AbstractQueuedSynchronizer.java:898)
	at java.util.concurrent.locks.AbstractQueuedSynchronizer.acquireInterruptibly(AbstractQueuedSynchronizer.java:1222)
	at java.util.concurrent.locks.ReentrantLock.lockInterruptibly(ReentrantLock.java:335)
	at com.cyborg2077.demo03.Test07.lambda$main$0(Test07.java:15)
	at java.lang.Thread.run(Thread.java:750)
```

#### 锁超时

```java
@Slf4j(topic = "c.TestTryLock")
public class Test {
    public static void main(String[] args) throws InterruptedException {
        ReentrantLock reentrantLock = new ReentrantLock();
        Thread t1 = new Thread(() -> {
            log.debug("启动");
            // if (!reentrantLock.tryLock(3, TimeUnit.SECONDS)) {
            //     log.debug("等待1s后获取失败，返回");
            if (!reentrantLock.tryLock()) {
                log.debug("获取锁失败，立刻返回");
                return;
            }
            try {
                log.debug("获取了锁");
            } finally {
                log.debug("释放了锁");
                reentrantLock.unlock();
            }
        },"t1");

        reentrantLock.lock();
        log.debug("获取了锁");
        t1.start();
        try {
            Thread.sleep(2000);
        } finally {
            log.debug("释放了锁");
            reentrantLock.unlock();
        }
    }
}
```

```bash
10:31:14.310 c.TestTryLock [main] - 获取了锁
10:31:14.313 c.TestTryLock [t1] - 启动
10:31:14.313 c.TestTryLock [t1] - 获取锁失败，立刻返回
10:31:16.313 c.TestTryLock [main] - 释放了锁
```

```bash
10:30:09.663 c.TestTryLock [main] - 获取了锁
10:30:09.666 c.TestTryLock [t1] - 启动
10:30:10.667 c.TestTryLock [t1] - 获取等待1s后失败，返回
10:30:11.667 c.TestTryLock [main] - 释放了锁
```

##### 解决哲学家就餐问题

哲学家就餐之所以会出现死锁，是因为一人手里一根筷子，都在等别人放下筷子，那么我们使用刚刚的tryLock来设置一个等待时间，到时自动放下筷子就好了

- 筷子类

  修改之前的代码，让筷子类继承ReentrantLock

  ```java
  public class Chopstick extends ReentrantLock {
      String name;
  
      public Chopstick(String name) {
          this.name = name;
      }
  
      @Override
      public String toString() {
          return "Chopstick{" +
                  "name='" + name + '\'' +
                  '}';
      }
  }
  ```

- 哲学家类

  ```java
  @Slf4j(topic = "c.Philosopher")
  public class Philosopher extends Thread {
      Chopstick left;
      Chopstick right;
  
      public Philosopher(String name, Chopstick left, Chopstick right) {
          super(name);
          this.left = left;
          this.right = right;
      }
  
      private void eat() {
          log.debug("我踏马吃吃吃");
          try {
              Thread.sleep(1000);
          } catch (InterruptedException e) {
              throw new RuntimeException(e);
          }
      }
  
      @Override
      public void run() {
          while (true) {
              // 尝试获取左手筷子
              if (left.tryLock()) {
                  try {
                      // 尝试获取右手筷子
                      if (right.tryLock()) {
                          // 吃完先放下 右手筷子
                          try {
                              eat();
                          } finally {
                              right.unlock();
                          }
                      }
                  // 没拿到右手筷子或者吃完了，把左手筷子也放了
                  } finally {
                      left.unlock();
                  }
              }
          }
      }
  }
  ```

- 就餐

  此类不需要做修改，现在再执行，五位哲学家就可以正常吃饭了，不会发生死锁

  ```java
  public class Test {
      public static void main(String[] args) {
          Chopstick c1 = new Chopstick("1");
          Chopstick c2 = new Chopstick("2");
          Chopstick c3 = new Chopstick("3");
          Chopstick c4 = new Chopstick("4");
          Chopstick c5 = new Chopstick("5");
  
          new Philosopher("苏格拉底", c1, c2).start();
          new Philosopher("柏拉图", c2, c3).start();
          new Philosopher("亚里士多德", c3, c4).start();
          new Philosopher("赫拉克利特", c4, c5).start();
          new Philosopher("阿基米德", c5, c1).start();
      }
  }
  ```

#### 条件变量

ReentrantLock支持多个条件变量，就好比

- synchronized是那些不满足条件的线程都在同一间休息室等消息
- ReentrantLock支持多间休息室，有专门等烟的休息室、专门等外卖的休息室、唤醒时也是按休息室来唤醒

使用要点

1. await前需要获得锁
2. await执行后，会释放锁，进入conditionObject等待
3. await的线程可以通过conditionObject的signal()方法来被唤醒去重新竞争lock锁，await的方法被打断或者超时的时候，也会去重新竞争lock锁
4. 竞争lock锁成功后，从await后继续执行

```java
@Slf4j(topic = "c.TestCondition")
public class Test {
    static ReentrantLock lock = new ReentrantLock();
    static Condition waitCigaretteQueue = lock.newCondition();
    static Condition waitTakeoutQueue = lock.newCondition();
    static volatile boolean hasCigarette = false;
    static volatile boolean hasTakeout = false;

    public static void main(String[] args) throws InterruptedException {
        new Thread(() -> {
            try {
                lock.lock();
                while (!hasCigarette) {
                    try {
                        waitCigaretteQueue.await();
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                    log.debug("拿到了烟");
                }
            } finally {
                lock.unlock();
            }
        }, "小南").start();

        new Thread(() -> {
            try {
                lock.lock();
                while (!hasTakeout) {
                    try {
                        waitTakeoutQueue.await();
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
                log.debug("拿到了外卖");
            } finally {
                lock.unlock();
            }
        }, "小女").start();

        Thread.sleep(1000);
        sendCigarette();
        Thread.sleep(1000);
        sendTakeout();

    }

    private static void sendCigarette() {
        lock.lock();
        try {
            log.debug("送烟的来了");
            hasCigarette = true;
            waitCigaretteQueue.signal();
        } finally {
            lock.unlock();
        }
    }

    private static void sendTakeout() {
        lock.lock();
        try {
            log.debug("送外卖的来了");
            hasTakeout = true;
            waitTakeoutQueue.signal();
        } finally {
            lock.unlock();
        }
    }
}
```

```bash
11:58:19.515 c.TestCondition [main] - 送烟的来了
11:58:19.518 c.TestCondition [小南] - 拿到了烟
11:58:20.519 c.TestCondition [main] - 送外卖的来了
11:58:20.519 c.TestCondition [小女] - 拿到了外卖
```



可以使用 `getHoldCount()` 方法查看当前线程的加锁次数：

```java
public static void main(String[] args) throws InterruptedException {
    ReentrantLock lock = new ReentrantLock();
    lock.lock();
    lock.lock();
    System.out.println("当前加锁次数："+lock.getHoldCount()+"，是否被锁："+lock.isLocked());
    TimeUnit.SECONDS.sleep(1);
    lock.unlock();
    System.out.println("当前加锁次数："+lock.getHoldCount()+"，是否被锁："+lock.isLocked());
    TimeUnit.SECONDS.sleep(1);
    lock.unlock();
    System.out.println("当前加锁次数："+lock.getHoldCount()+"，是否被锁："+lock.isLocked());
}
```

可以看到，当锁不再被任何线程持有时，值为`0`，并且通过`isLocked()`方法查询结果为`false`。

实际上，如果存在线程持有当前的锁，那么其他线程在获取锁时，是会暂时进入到等待队列的，可以通过 `getQueueLength()` 方法获取等待中线程数量的预估值，通过 `hasQueuedThread()` 方法来判断某个线程是否正在等待获取锁状态。：

```java
public static void main(String[] args) throws InterruptedException {
    ReentrantLock lock = new ReentrantLock();
    lock.lock();
    Thread t1 = new Thread(lock::lock), t2 = new Thread(lock::lock);;
    t1.start();
    t2.start();
    TimeUnit.SECONDS.sleep(1);
    System.out.println("当前等待锁释放的线程数："+lock.getQueueLength());
    System.out.println("线程1是否在等待队列中："+lock.hasQueuedThread(t1));
    System.out.println("线程2是否在等待队列中："+lock.hasQueuedThread(t2));
    System.out.println("当前线程是否在等待队列中："+lock.hasQueuedThread(Thread.currentThread()));
}
```

同样的，通过使用 `getWaitQueueLength()` 方法也能够查看同一个Condition目前有多少线程处于等待状态。

```java
public static void main(String[] args) throws InterruptedException {
    ReentrantLock lock = new ReentrantLock();
    Condition condition = lock.newCondition();
    new Thread(() -> {
       lock.lock();
        try {
            condition.await();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        lock.unlock();
    }).start();
    TimeUnit.SECONDS.sleep(1);
    lock.lock();
    System.out.println("当前Condition的等待线程数："+lock.getWaitQueueLength(condition));
    condition.signal();
    System.out.println("当前Condition的等待线程数："+lock.getWaitQueueLength(condition));
    lock.unlock();
}
```

#### 公平锁与非公平锁

* 公平锁：多个线程按照申请锁的顺序去获得锁，线程会直接进入队列去排队，永远都是队列的第一位才能得到锁。
* 非公平锁：多个线程去获取锁的时候，会直接去尝试获取，获取不到，再去进入等待队列，如果能获取到，就直接获取到锁。

***

### 读写锁 ReentrantReadWriteLock

ReentrantReadWriteLock 是 Java 的一种读写锁，它允许多个读线程同时访问，但只允许一个写线程访问（会阻塞所有的读写线程）。这种锁的设计可以提高性能，特别是在读操作的数量远远超过写操作的情况下。

读写锁维护了一个读锁和一个写锁，这两个锁的机制是不同的。

* 读锁：在没有任何线程占用写锁的情况下，同一时间可以有多个线程加读锁。
* 写锁：在没有任何线程占用读锁的情况下，同一时间只能有一个线程加写锁。

读写锁也有一个专门的接口

```java
public interface ReadWriteLock {
    //获取读锁
    Lock readLock();
  	//获取写锁
    Lock writeLock();
}
```

ReadLock 和 WriteLock 是靠内部类 Sync 实现的锁。Sync 是 AQS 的一个子类，这种结构在 CountDownLatch、Semaphore、ReentrantLock 里面也都存在。

在 AQS 中提到了 state 字段（int 类型，32 位），该字段用来描述有多少线程持有锁。

在独享锁中，这个值通常是 0 或者 1（如果是重入锁的话 state 值就是重入的次数），在共享锁中 state 就是持有锁的数量。但是在 ReentrantReadWriteLock 中有读、写两把锁，所以需要在一个整型变量 state 上分别描述读锁和写锁的数量。

于是将 state 变量“按位切割”切分成了两个部分，高 16 位表示读锁状态（读锁个数），低 16 位表示写锁状态（写锁个数）。如下图所示

注意我们操作ReentrantReadWriteLock时，不能直接上锁，而是需要获取读锁或是写锁，再进行锁操作。

下面的代码展示了如何使用 ReentrantReadWriteLock 来实现一个线程安全的计数器：

```java
public class Counter {
    private final ReentrantReadWriteLock rwl = new ReentrantReadWriteLock();
    private final Lock r = rwl.readLock();
    private final Lock w = rwl.writeLock();
    private int count = 0;

    public int getCount() {
        r.lock();
        try {
            return count;
        } finally {
            r.unlock();
        }
    }

    public void inc() {
        w.lock();
        try {
            count++;
        } finally {
            w.unlock();
        }
    }
}
```

并且，ReentrantReadWriteLock不仅具有读写锁的功能，还保留了可重入锁和公平/非公平机制，比如同一个线程可以重复为写锁加锁，并且必须全部解锁才真正释放锁：

```java
public static void main(String[] args) throws InterruptedException {
    ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    lock.writeLock().lock();
    lock.writeLock().lock();
    new Thread(() -> {
        lock.writeLock().lock();
        System.out.println("成功获取到写锁！");
    }).start();
    System.out.println("释放第一层锁！");
    lock.writeLock().unlock();
    TimeUnit.SECONDS.sleep(1);
    System.out.println("释放第二层锁！");
    lock.writeLock().unlock();
}
```

#### 锁降级

锁降级指的是写锁降级为读锁。当一个线程持有写锁的情况下，虽然其他线程不能加读锁，但是线程自己是可以加读锁：

```java
public static void main(String[] args) throws InterruptedException {
    ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    lock.writeLock().lock();
    lock.readLock().lock();
    System.out.println("成功加读锁！");
}
```

那么，如果我们在同时加了写锁和读锁的情况下，释放写锁，是否其他的线程就可以一起加读锁了呢？

```java
public static void main(String[] args) throws InterruptedException {
    ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    lock.writeLock().lock();
    lock.readLock().lock();
    new Thread(() -> {
        System.out.println("开始加读锁！");
        lock.readLock().lock();
        System.out.println("读锁添加成功！");
    }).start();
    TimeUnit.SECONDS.sleep(1);
    lock.writeLock().unlock();    //如果释放写锁，会怎么样？
}
```

可以看到，一旦写锁被释放，那么主线程就只剩下读锁了，因为读锁可以被多个线程共享，所以这时第二个线程也添加了读锁。而这种操作，就被称之为"锁降级"（注意不是先释放写锁再加读锁，而是持有写锁的情况下申请读锁再释放写锁）。

注意在仅持有读锁的情况下去申请写锁，属于"锁升级"，ReentrantReadWriteLock是不支持的。

### 线程阻塞唤醒类LockSupport

park & unpark 是 LockSupport 类中的方法，用来阻塞和唤醒线程，，底层实现依赖于 [Unsafe 类](https://javabetter.cn/thread/Unsafe.html)，是 `java.util.concurrent` 中许多同步器（如 `AbstractQueuedSynchronizer`）的基础：

```java
// 暂停当前线程
LockSupport.park();
// 回复某个线程的运行
LockSupport.unpark(暂停线程对象);
```

与 Object 的 `wait & notify` 对比：

- wait、notify、notifyAll 必须配合 Object Monitor 一起使用，而 park、unpark 不必
- `park & unpark` 是以线程为单位来阻塞和唤醒线程的，而notify只能随机唤醒一个等待中的线程，notifyAll是唤醒所有等待线程，不精确
- `park & unpark` 可以先unpark，而 `wait & notify` 只能不能先notify

<img src="/juc-img/image-20260111010055147.png" alt="image-20260111010055147" style="zoom:33%;" />

每个线程在 JVM 中确实关联一个 `Parker` 对象，包含三个核心字段：

- `_counter`：许可（permit）标志，0 表示无许可，1 表示有许可。
- `_mutex`：互斥锁（用于保护 `_counter` 和 `_cond` 的操作）。
- `_cond`：条件变量（用于线程挂起/唤醒）。

当线程调用 `Unsafe.park()`（或 `LockSupport.park()`）时：

1. **检查 `_counter` 是否为 1**：
   - 如果是 → 将 `_counter` 设为 0，**立即返回**（不阻塞）。
   - 如果否（即 `_counter == 0`）→ 进入阻塞流程。
2. **获取 `_mutex` 锁**（进入临界区）。
3. **再次检查 `_counter`**（防止在检查后、加锁前被 `unpark`）：
   - 如果此时 `_counter == 1` → 设为 0，释放 `_mutex`，返回（不阻塞）。
   - 否则 → 调用 `pthread_cond_wait(&_cond, &_mutex)`，**原子地释放 `_mutex` 并挂起线程**。
4. 当被 `unpark` 或虚假唤醒（spurious wakeup）时，线程被唤醒，重新获得 `_mutex`。
5. **无论何种原因唤醒，都设置 `_counter = 0`**（消耗许可），然后释放 `_mutex`，继续执行。

当其他线程调用 `Unsafe.unpark(t)` 时：

1. 获取目标线程 `t` 的 `Parker` 对象的 `_mutex`。
2. **将 `_counter` 设置为 1**（即使它已经是 1，也还是设为 1 —— 即**最多只保留一份许可**）。
3. **如果线程 `t` 正在 `_cond` 上等待（即已调用 `park` 并阻塞）**：
   - 调用 `pthread_cond_signal(&_cond)` 唤醒它。
   - （注意：唤醒是“通知”，不是“立即运行”）
4. 释放 `_mutex`。

> 关键点：`unpark` **可以先于 `park` 调用**！此时 `_counter = 1`，后续 `park` 会直接返回。

总结：

- `park()`：
  若有许可（`_counter == 1`）→ 消耗许可，立即返回；
  否则 → 阻塞，直到被 `unpark` 唤醒或虚假唤醒，唤醒后消耗许可。
- `unpark(t)`：
  给线程 `t` 发放一个许可（`_counter = 1`），若其正在 `park` 中则唤醒它。
  **许可不叠加**，多次 `unpark` 效果等同于一次。

#### Dump线程

"Dump 线程"通常是指获取线程的当前状态和调用堆栈的详细快照。这可以提供关于线程正在执行什么操作以及线程在代码的哪个部分的重要信息。

下面是线程转储中可能包括的一些信息：

- 线程 ID 和名称：线程的唯一标识符和可读名称。
- 线程状态：线程的当前状态，例如运行（RUNNABLE）、等待（WAITING）、睡眠（TIMED_WAITING）或阻塞（BLOCKED）。
- 调用堆栈：线程的调用堆栈跟踪，显示线程从当前执行点回溯到初始调用的完整方法调用序列。
- 锁信息：如果线程正在等待或持有锁，线程转储通常还包括有关这些锁的信息。

线程转储可以通过各种方式获得，例如使用 Java 的 jstack 工具，或从 Java VisualVM、Java Mission Control 等工具获取。

下面是一个简单的例子，通过 LockSupport 阻塞线程，然后通过 Intellij IDEA 查看 dump 线程信息。

```java
public class LockSupportDemo {
    public static void main(String[] args) {
        LockSupport.park();
    }
}
```

运行，然后再 Run 面板中点击「attach debugger」。

<img src="/juc-img/LockSupport-20230816130537.png" alt="img" style="zoom:50%;" />

然后在 debugger 面板中右键选择「export thread」。

<img src="/juc-img/LockSupport-20230816130629.png" alt="img" style="zoom:30%;" />

就可以看了 Dump 线程信息了。

<img src="/juc-img/LockSupport-20230816130730.png" alt="img" style="zoom:30%;" />

**调用 park(Object blocker)方法 dump 线程**

```bash
"main" #1 prio=5 os_prio=0 tid=0x0069cc00 nid=0x6c0 waiting on condition [0x00dcf000]
   java.lang.Thread.State: WAITING (parking)
        at sun.misc.Unsafe.park(Native Method)
        - parking to wait for  <0x048c2d18> (a java.lang.String)
        at java.util.concurrent.locks.LockSupport.park(LockSupport.java:175)
        at learn.LockSupportDemo.main(LockSupportDemo.java:7)
```

分别调用无参和有参的 park 方法，然后通过 dump 线程信息可以看出，带 Object 的 park 方法相较于无参的 park 方法会增加 `parking to wait for <0x048c2d18> (a java.lang.String）`的信息。

## 十一、队列同步器AQS

**AQS** 是 `AbstractQueuedSynchronizer` 的简称，即抽象队列同步器：

- 抽象：抽象类，只实现一些主要逻辑，有些方法由子类实现；
- 队列：使用先进先出（FIFO）的队列存储数据；
- 同步：实现了同步的功能。

AQS 是一个用来构建锁和同步器的框架，它为实现依赖于先进先出（FIFO）等待队列的阻塞锁和相关同步器（如 ReentrantLock、CountDownLatch、Semaphore、ReentrantReadWriteLock 等）提供了基础。

当然我们也可以利用 AQS 轻松定制专属的同步器，只要实现它的几个`protected`方法。

### 核心源码

#### 状态管理 state

AQS 内部使用了一个 volatile 的变量 state 来表示同步状态。

```java
/**
 * The synchronization state.
 */
private volatile int state;
```

提供了以下方法用于操作状态（子类需根据语义重写）：

```java
protected final int getState()
protected final void setState(int newState)
protected final boolean compareAndSetState(int expect, int update)
```

这三种操作均是原子操作，其中 compareAndSetState 的实现依赖于 Unsafe 的 `compareAndSwapInt()` 方法。

#### AQS SyncQueue 同步队列

*CLH 是一种经典的公平锁排队算法（原为自旋），而 AQS 的同步队列是其面向阻塞线程模型的双向改进版——因此可以说 AQS 的同步队列是“基于 CLH 思想的阻塞式队列”。*

AQS 维护了一个先进先出（FIFO）的双端队列，并使用了两个引用 head 和 tail 用于标识队列的头部和尾部，用于管理等待获取资源的线程。其数据结构如下图所示：

<img src="/juc-img/aqs-c294b5e3-69ef-49bb-ac56-f825894746ab.png" alt="img" style="zoom: 33%;" />

![image-20230306171328049](/juc-img/KMmHZ6g7xVO5zcG.png)

但它并不直接储存线程，而是储存拥有线程的 Node 节点。

<img src="/juc-img/aqs-20230805211157.png" alt="img" style="zoom:50%;" />

#### 资源获取模式

AQS 支持两种资源获取模式，或者说两种同步方式：

- 独占模式（Exclusive）：资源是独占的，一次只能有一个线程获取。如 ReentrantLock。

  - 核心方法（需子类实现）：

    ```java
    protected boolean tryAcquire(int arg) {
        throw new UnsupportedOperationException();
    }
    protected boolean tryRelease(int arg)
    protected boolean isHeldExclusively() //该线程是否正在独占资源，只有用到 condition 才需要去实现它
    ```

  - 对应入口方法（由 AQS 实现）：

    ```java
    public final void acquire(int arg)
    public final boolean release(int arg)
    ```

- 共享模式（Share）：同时可以被多个线程获取，具体的资源个数可以通过参数指定。如 Semaphore/CountDownLatch。

  - 核心方法（需子类实现）：

    ```java
    protected int tryAcquireShared(int arg)
    protected boolean tryReleaseShared(int arg)
    ```

  * 对应入口方法（由 AQS 实现）：

    ```java
    public final void acquireShared(int arg)
    public final boolean releaseShared(int arg)
    ```

以上方法体现了 AQS 基于**模板方法模式**的设计：

* 带 try 的方法是策略，由子类实现，定义资源获取/释放的具体规则
* 不带 try 的方法是流程，由AQS实现，提供排队、阻塞、唤醒等通用同步机制

> [!NOTE]
>
> 这里不使用抽象方法的目的是：避免强迫子类中把所有的抽象方法都实现一遍，这样子类只需要实现自己关心的抽象方法即可。

一般情况下，子类只需要根据需求实现其中一种模式就可以，当然也有同时实现两种模式的同步类，如 ReadWriteLock。

##### Node线程节点

AQS 中关于这两种资源共享模式的定义源码均在内部类 Node 中。

```java
static final class Node {
    // 标记一个结点（对应的线程）在共享模式下等待
    static final Node SHARED = new Node();
    // 标记一个结点（对应的线程）在独占模式下等待
    static final Node EXCLUSIVE = null;

    // waitStatus的值，表示该结点（对应的线程）已被取消
    static final int CANCELLED = 1;
    // waitStatus的值，表示后继结点（对应的线程）需要被唤醒
    static final int SIGNAL = -1;
    // waitStatus的值，表示该结点（对应的线程）在等待某一条件
    static final int CONDITION = -2;
    /*waitStatus的值，表示有资源可用，新head结点需要继续唤醒后继结点（共享模式下，多线程并发释放资源，而head唤醒其后继结点后，需要把多出来的资源留给后面的结点；设置新的head结点时，会继续唤醒其后继结点）*/
    static final int PROPAGATE = -3;

    // 等待状态，取值范围，-3，-2，-1，0，1
    volatile int waitStatus;
    volatile Node prev; // 前驱结点
    volatile Node next; // 后继结点
    volatile Thread thread; // 结点对应的线程
    Node nextWaiter; /*在条件队列中，指向下一个等待节点（单向链表的 next 指针）；在同步队列中，不是指向下一个节点，它是一个模式标记，指向SHARED或EXCLUSIVE*/


    // 判断共享模式的方法
    final boolean isShared() {
        return nextWaiter == SHARED;
    }

    Node(Thread thread, Node mode) {     // Used by addWaiter
        this.nextWaiter = mode;
        this.thread = thread;
    }

    // 其它方法忽略，可以参考具体的源码
}
```

这里的 waitStatus 用来标记当前节点的状态，有以下几种：

- CANCELLED：表示当前节点（对应的线程）已被取消。当等待超时或被中断，会触发进入为此状态，进入该状态后节点状态不再变化；
- SIGNAL：后面节点等待当前节点唤醒；
- CONDITION：Condition 中使用，当前线程阻塞在Condition，如果其他线程调用了Condition的signal方法，这个节点将从等待队列转移到同步队列队尾，等待获取同步锁；
- PROPAGATE：共享模式，前置节点唤醒后面节点后，唤醒操作无条件传播下去；
- 0：中间状态，当前节点后面的节点已经唤醒，但是当前节点线程还没有执行完成。

##### 获取资源 `acquire(arg)`

```java
/**
 * 以独占模式获取同步状态（例如：获取锁）。
 * 
 * 该方法由子类（如 ReentrantLock）在 lock() 中调用。
 * @param arg 获取操作的参数（通常为1，表示请求一次许可）
 */
public final void acquire(int arg) {
    // tryAcquire 尝试获取锁资源，如果尝试成功，返回true，尝试失败返回false
    if (!tryAcquire(arg) &&
        // 走到这，代表获取锁资源失败，需要将当前线程封装成一个Node，追加到AQS的队列中
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
        // 线程中断
        selfInterrupt();
}

private Node addWaiter(Node mode) {
    //创建 Node 类，并且设置 thread 为当前线程，设置为排它锁
    Node node = new Node(Thread.currentThread(), mode);
    // 获取 AQS 中队列的尾部节点
    Node pred = tail;
    // 如果 tail == null，说明是空队列，
    // 不为 null，说明现在队列中有数据，
    if (pred != null) {
        // 将当前节点的 prev 指向刚才的尾部节点，那么当前节点应该设置为尾部节点
        node.prev = pred;
        // CAS 将 tail 节点设置为当前节点
        if (compareAndSetTail(pred, node)) {
            // 将之前尾节点的 next 设置为当前节点
            pred.next = node;
            // 返回当前节点
            return node;
        }
    }
    enq(node);
    return node;
}

// 自旋CAS插入同步队列
private Node enq(final Node node) {
    for (;;) {
        Node t = tail;
        if (t == null) { // Must initialize
            if (compareAndSetHead(new Node()))
                tail = head;
        } else {
            node.prev = t;
            if (compareAndSetTail(t, node)) {
                t.next = node;
                return t;
            }
        }
    }
}
```

<img src="/juc-img/aqs-a0689bb2-9b18-419d-9617-6d292fbd439d-8585384.jpg" alt="aqs-a0689bb2-9b18-419d-9617-6d292fbd439d" style="zoom:50%;" />

##### 释放资源 `release(arg)`

```java
/**
 * 释放独占模式下的同步状态。
 * 
 * 此方法由持有锁的线程调用（如 ReentrantLock.unlock()）。
 * 它首先尝试释放资源（由子类实现 tryRelease），若成功且队列中有等待线程，
 * 则唤醒同步队列中的下一个有效等待者。
 *
 * @param arg 释放的参数（通常为1，表示释放一次持有）
 * @return true 表示成功释放并可能已唤醒后继；false 表示释放失败（如未持有锁）
 */
public final boolean release(int arg) {
    // 1. 调用子类定义的 tryRelease 尝试释放同步状态
    //    成功条件：通常是 state 归零（对于可重入锁）
    if (tryRelease(arg)) {
        // 2. 获取当前同步队列的头节点（head 是哑节点，其 next 才是第一个真实等待者）
        Node h = head;
        
        // 3. 如果头节点存在且其 waitStatus 不为 0，
        //    说明有后继节点在等待（因为只有当后继需要被唤醒时，
        //    前驱才会被设为 SIGNAL(-1) 或其他非0状态）
        if (h != null && h.waitStatus != 0)
            unparkSuccessor(h); // 唤醒头节点的后继（即第一个有效等待线程）
        
        return true;
    }
    return false; // 释放失败（如非法调用 unlock）
}

/**
 * 唤醒指定节点的后继节点（即同步队列中排在它后面的线程）。
 * 
 * 注意：此方法传入的是“前驱节点”（通常是 head），目标是唤醒它的后继。
 * 由于 CLH 队列支持取消操作，后继可能已被取消（waitStatus = CANCELLED），
 * 因此需从尾部向前查找第一个有效的等待节点。
 *
 * @param node 当前释放锁的节点（通常是 head 哑节点）
 */
private void unparkSuccessor(Node node) {
    // 1. 获取当前节点的等待状态
    int ws = node.waitStatus;
    
    // 2. 如果状态为负值（如 SIGNAL=-1, CONDITION=-2, PROPAGATE=-3），
    //    尝试将其重置为 0（清理状态，非必须但有助于 GC 和状态清晰）
    //    注意：CAS 失败也没关系，不影响唤醒逻辑
    if (ws < 0)
        compareAndSetWaitStatus(node, ws, 0);

    // 3. 获取直接后继节点（node.next）
    Node s = node.next;
    
    // 4. 如果直接后继为空，或已被取消（waitStatus > 0，即 CANCELLED=1），
    //    说明该后继无效，不能唤醒。
    if (s == null || s.waitStatus > 0) {
        s = null;
        // 5. 从队列尾部向前遍历，寻找离当前节点最近的、未被取消的有效等待节点
        //    为什么从 tail 开始？因为 next 指针在并发入队时可能尚未完全建立，
        //    但 prev 指针在 enq() 中是原子设置的，更可靠。
        for (Node t = tail; t != null && t != node; t = t.prev)
            if (t.waitStatus <= 0) // 找到第一个有效节点（SIGNAL/PROPAGATE/0）
                s = t;
    }
    
    // 6. 如果找到了有效的后继节点，则唤醒其关联的线程
    if (s != null)
        LockSupport.unpark(s.thread); // 线程将从 park() 中恢复，继续 acquireQueued 循环
}
```

在 `ReentrantLock` 的实现中，`tryRelease(arg)` 会减少持有锁的数量，如果持有锁的数量变为0，释放锁并返回true。

如果 `tryRelease(arg)` 成功释放了锁，那么接下来会检查队列的头结点。如果头结点存在并且waitStatus不为0（这意味着有线程在等待），那么会调用 `unparkSuccessor(Node h)` 方法来唤醒等待的线程。

![image-20230306171428206](/juc-img/fUmwyGTRdCKAOlM.png)

##### 可重入锁ReetrantLock的实现

入口方法是由持有同步器的应用程序线程调用的，比如：

```java
ReentrantLock lock = new ReentrantLock();
lock.lock();   // 会调用 Sync.lock() → AQS.acquire()
try {
    // 临界区
} finally {
    lock.unlock(); // 会调用 Sync.release(1) → AQS.release()
}
```

**`Sync` 是 `ReentrantLock` 的核心抽象内部类**，它继承自 AQS（`AbstractQueuedSynchronizer`），负责实现 `ReentrantLock` 的**同步语义**。

* **实现可重入逻辑**：同一个线程可以多次获取锁（`state` 递增）。

* **桥接 `ReentrantLock` API 与 AQS**：

  * 获取锁：`ReetrantLock.lock()` → `sync.lock()` →
    • **非公平**：`NonfairSync.lock()` → `AQS.acquire(1)`（若抢锁失败）→ `NonFairSync.tryAcquire(1)` → `Sync.nonfairTryAcquire(1)`
    • **公平**：`FairSync.lock()` → `AQS.acquire(1)` → `FairSync.tryAcquire(1)` → `FairSync.tryAcquire(1)`

  * 释放锁：

    ```
    ReentrantLock.unlock()
        → sync.release(1)
            → AQS.release(1)
                → Sync.tryRelease(1)          // ← 公平/非公平共用同一实现！
                    （更新 state，判断是否完全释放）
                → 若 tryRelease 返回 true：
                    → unparkSuccessor(head)   // 唤醒同步队列中的下一个有效等待线程
    ```

* **区分公平/非公平策略**：通过 `NonfairSync` 和 `FairSync` 两个子类实现。

```java
public class ReentrantLock implements Lock, java.io.Serializable {
    private final Sync sync; // 指向实际使用的 Sync 子类实例
  	public ReentrantLock() {
    		sync = new NonfairSync();
		}
    public ReentrantLock(boolean fair) {
    		sync = fair ? new FairSync() : new NonfairSync();
		}
  
    public void lock() {
        // 委托给内部的 Sync 对象（实际是 NonfairSync 或 FairSync）
        sync.lock();
    }
  
  	public void unlock() {
    		sync.release(1);
		}
  
    // Sync 是 ReentrantLock 的抽象内部类，继承 AQS
    abstract static class Sync extends AbstractQueuedSynchronizer {
      
        final boolean nonfairTryAcquire(int acquires) {
            final Thread current = Thread.currentThread();
            int c = getState();
            //1. 如果该锁未被任何线程占有，该锁能被当前线程获取
            if (c == 0) {
                if (compareAndSetState(0, acquires)) {
                    setExclusiveOwnerThread(current);
                    return true;
                }
            }
            //2.若被占有，检查占有线程是否是当前线程
            else if (current == getExclusiveOwnerThread()) {
            // 3. 再次获取，计数加一
                int nextc = c + acquires;
                if (nextc < 0) // overflow
                    throw new Error("Maximum lock count exceeded");
                setState(nextc);
                return true;
            }
            return false;
        }
      
        // 由sync统一实现
        protected final boolean tryRelease(int releases) {
            int c = getState() - releases; // 减去释放次数（通常为1）

            // 检查是否是锁持有者调用 unlock（防止非法释放）
            if (Thread.currentThread() != getExclusiveOwnerThread())
                throw new IllegalMonitorStateException();

            boolean free = false;
            if (c == 0) { // 重入次数归零 → 完全释放
                free = true;
                setExclusiveOwnerThread(null); // 清空持有线程
            }
            setState(c); // 更新 state
            return free; // 只有完全释放才返回 true，触发唤醒
        }
    }

    // 非公平锁实现
    static final class NonfairSync extends Sync {
        /**
         * 非公平加锁：
         * 1. 先尝试直接 CAS 抢占锁（即使队列中有等待者也抢！）
         * 2. 抢失败再走 AQS 标准 acquire 流程
         */
        final void lock() {
            // 【快速路径】直接尝试将 state 从 0 → 1
            if (compareAndSetState(0, 1))
                // 抢成功，设置当前线程为独占持有者
                setExclusiveOwnerThread(Thread.currentThread());
            else
                // 抢失败，进入 AQS 的 acquire 流程（排队 + 阻塞）
                acquire(1);
        }

        // 覆盖 AQS 的 tryAcquire，委托给父类 Sync 的 nonfairTryAcquire
        protected final boolean tryAcquire(int acquires) {
            return nonfairTryAcquire(acquires);
        }
    }

    // 公平锁实现
    static final class FairSync extends Sync {
        /**
         * 公平加锁：
         * 直接进入 AQS 的 acquire 流程，不尝试直接抢锁。
         * 在 tryAcquire 中会检查队列是否有前驱，确保 FIFO。
         */
        final void lock() {
            acquire(1); // 直接排队，不抢！
        }

        protected final boolean tryAcquire(int acquires) {
            final Thread current = Thread.currentThread();
            int c = getState();
            if (c == 0) {
                // 【公平性检查】只有当队列为空 or 当前线程是队首时才允许获取
                if (!hasQueuedPredecessors() &&
                    compareAndSetState(0, acquires)) {
                    setExclusiveOwnerThread(current);
                    return true;
                }
            }
            else if (current == getExclusiveOwnerThread()) {
                // 可重入逻辑（与非公平相同）
                int nextc = c + acquires;
                if (nextc < 0)
                    throw new Error("Maximum lock count exceeded");
                setState(nextc);
                return true;
            }
            return false;
        }
    }
}
```

> [!NOTE]
>
> **公平锁一定公平吗？**
>
> ![image-20230814160110441](/juc-img/5IwjDocXvHpkW8O.png)
>
> 因此公不公平重点在 `hasQueuedPredecessors()`，此方法只有在等待队列中存在节点时才能保证不会出现问题。所以公平锁，只有在等待队列存在节点时，才是真正公平的。

#### 条件队列 ConditionObject<a id="条件队列"></a>

AQS 的**非静态内部类** `ConditionObject` 实现了 `Condition` 接口，可以直接访问 AQS 的 `state`、`head`、`tail`、`Node` 等成员。

```java
public class ConditionObject implements Condition, java.io.Serializable {
    private static final long serialVersionUID = 1173984872572414699L;
    /** 条件队列的头结点 */
    private transient Node firstWaiter;
    /** 条件队列的尾结点 */
    private transient Node lastWaiter;
  	//...
```

当你调用 `ReentrantLock.newCondition()`（或其他基于 AQS 的同步器的 `newCondition()` 方法）时，**返回的就是 AQS 内部类 `ConditionObject` 的实例**。

```java
// ReentrantLock.java
public Condition newCondition() {
    return sync.newCondition(); // sync 是 ReentrantLock 的内部 Sync 类，继承自 AQS
}

// AbstractQueuedSynchronizer.java
public final ConditionObject newCondition() {
    return new ConditionObject();
}
```

`ConditionObject` 底层维护了一个**单向条件队列**（与主 CLH 队列分离），节点仍然使用的是AQS的Node内部类，并通过 `Node.nextWaiter` 链接。

ReentrantLock 等 AQS 是可以持有一个同步队列和多个等待队列的，多次 newCondition 就行了。示意图如下：

![image-20230306171600419](/juc-img/h7z96EeqVvpHOLQ.png)

> [!IMPORTANT]
>
> Node 内部类**被复用于 Condition 条件队列和 AQS 同步队列**。
>
> * AQS 通过 `waitStatus` 字段辅助判断：
>
>   | `waitStatus` 值                         | 含义             |
>   | --------------------------------------- | ---------------- |
>   | `Node.CONDITION` (-2)                   | 节点在条件队列中 |
>   | 其他值（如 0, SIGNAL=-1, PROPAGATE=-3） | 节点在同步队列中 |
>
> * 在两种情形下，字段 `nextWaiter` 的**语义完全不同**，见上方注释
>
>   * 同步队列是**双向链表**，靠 `prev` / `next` 维护结构，所以 `nextWaiter` 可用于存储**等待模式**；
>
>   * **条件队列中不需要共享/独占标记，Condition 只能在独占锁下使用**，因此不需要存储模式标记，`nextWaiter` 可用于构建**单向链表**。
>
> <img src="/juc-img/截屏2026-01-12 20.17.05.png" alt="截屏2026-01-12 20.17.05" style="zoom:50%;" />

##### `await()` 方法

当一个线程调用 `await()` 方法时，会进入等待状态，加入到存储这些处于等待状态线程的条件队列，线程对应的 Node 中的 nextWaiter 指向队列中的下一个节点，并且进入到条件队列的 Node 节点状态都会被设置为 CONDITION，直到其他线程调用 `signal()` 方法将其唤醒。

先明确 `await()` 方法的目标：

* 只有已经持有锁的线程才可以使用此方法
* 当调用此方法后，会直接释放锁，无论加了多少次锁
* 只有其他线程调用 `signal()` 或是被中断时才会唤醒等待中的线程
* 被唤醒后，需要等待其他线程释放锁，拿到锁之后才可以继续执行，并且会恢复到之前的状态（await之前加了几层锁唤醒后依然是几层锁）

```java
// AbstractQueuedSynchronizer.ConditionObject这个内部类中的方法
public final void await() throws InterruptedException {
    // 1. 检查线程是否已被中断（响应中断优先于进入等待）
    if (Thread.interrupted())
        throw new InterruptedException();

    // 2. 将当前线程封装为一个 CONDITION 状态的节点，并添加到条件队列尾部
    Node node = addConditionWaiter();

    // 3. 完全释放当前线程持有的同步状态（例如 ReentrantLock 的全部重入次数），
    //    并保存释放前的 state 值，以便后续重新获取相同数量的锁
    int savedState = fullyRelease(node);

    // 4. 中断模式标记：
    //    0 = 未中断；
    //    THROW_IE(-1) = 在等待期间被中断，且尚未收到 signal → 应抛出 InterruptedException
    //    REINTERRUPT(1) = 在等待期间被中断，但已经收到 signal 并进入同步队列 → 不抛异常，仅在退出时重新设置中断状态
    int interruptMode = 0;

    // 5. 循环检查当前节点是否已被转移到 AQS 的主同步队列中。
    //    只有在 signal() 被调用后，节点才会从条件队列移到同步队列。
    //    若尚未转移，则挂起当前线程，等待被 signal 或中断唤醒。
    while (!isOnSyncQueue(node)) {
        LockSupport.park(this); // 挂起线程（可被 unpark 或中断唤醒）

        // 6. 检查在等待过程中是否发生了中断。
        //    若有中断，根据中断发生时机决定返回 THROW_IE 或 REINTERRUPT
        if ((interruptMode = checkInterruptWhileWaiting(node)) != 0)
            break; // 中断发生，退出等待循环
    }

    // 7. 此时节点已在同步队列中（因 signal 或中断被转移），
    //    调用 acquireQueued 尝试以“排队”方式重新获取锁（可能再次阻塞）。
    //    如果在获取锁的过程中再次被中断，且之前不是 THROW_IE 模式，
    //    则记录为 REINTERRUPT（延迟响应中断）。
    if (acquireQueued(node, savedState) && interruptMode != THROW_IE)
        interruptMode = REINTERRUPT;

    // 8. 清理条件队列中已取消的等待节点（如因中断或超时被移除的节点），
    //    因为 nextWaiter 在条件队列中用于链接下一个等待者（非共享/独占标记）
    if (node.nextWaiter != null)
        unlinkCancelledWaiters();

    // 9. 根据中断模式，决定是抛出异常还是恢复中断状态
    if (interruptMode != 0)
        reportInterruptAfterWait(interruptMode);
}
```

1、调用 addConditionWaiter 方法会将当前线程添加到等待队列中，源码如下：

```java
private Node addConditionWaiter() {
 Node t = lastWaiter;
 if (t != null && t.waitStatus != Node.CONDITION) {
  //将不处于等待状态的节点从条件队列中移除
  unlinkCancelledWaiters();
  t = lastWaiter;
 }
 Node node = new Node(Thread.currentThread(), Node.CONDITION);
 //尾节点为空
 if (t == null)
        //将首节点指向node
  firstWaiter = node;
 else
  //将尾节点的nextWaiter指向node节点
  t.nextWaiter = node;
 //尾节点指向node
 lastWaiter = node;
 return node;
}
```

首先将 t 指向尾节点，如果尾节点不为空并且它的`waitStatus!=-2`（-2 为 CONDITION，表示正在等待 Condition 条件），则将不处于等待状态的节点从等待队列中移除，并且将 t 指向新的尾节点。

然后将当前线程封装成 waitStatus 为-2 的节点追加到等待队列尾部。

* 如果尾节点为空，则表明队列为空，将首尾节点都指向当前节点。

  <img src="/juc-img/condition-20230901142620.png" alt="img" style="zoom:50%;" />

* 如果尾节点不为空，表明队列中有其他节点，则将当前尾节点的 nextWaiter 指向当前节点，将当前节点置为尾节点。

  <img src="/juc-img/condition-20230901142728.png" alt="img" style="zoom:50%;" />

简单总结一下，这段代码的作用就是**通过尾插入的方式将当前线程封装的 Node 插入到等待队列中**，同时可以看出，Condtion等待队列是一个**不带头节点的链式队列**（链表的第一个节点就是第一个实际的数据节点），而AQS同步队列则是一个**带头节点的链式队列**。

2、释放锁是在当前节点插入到等待对列之后由 fullyRelease 方法实现，源码如下：

```java
final int fullyRelease(Node node) {
 //释放锁失败为true，释放锁成功为false
 boolean failed = true;
 try {
     //获取当前锁的state
  int savedState = getState();
  //释放锁成功的话
  if (release(savedState)) {
   failed = false;
   return savedState;
  } else {
   throw new IllegalMonitorStateException();
  }
 } finally {
  if (failed)
   //释放锁失败的话将节点状态置为取消
   node.waitStatus = Node.CANCELLED;
 }
}
```

调用 AQS 的模板方法 release 释放 AQS 的同步状态并且唤醒在同步队列中头节点的后继节点引用的线程，如果释放成功则正常返回，若失败的话就抛出异常。

3、从 `await` 方法中退出，只有两种情况：

1. 当前等待的线程被**中断**代码 **break 退出**
2. **当前节点被移动到了同步队列中**（即另外一个线程调用了 condition 的 signal 或者 signalAll 方法），**while 中逻辑判断为 false 后结束 while 循环**

`isOnSyncQueue` 方法用于判断当前线程所在的 Node 是否在同步队列中。

<img src="/juc-img/condition-20230901154323.png" alt="condition-20230901154323" style="zoom:30%;" />

* 如果当前节点的 waitStatus=-2，说明它在等待队列中，返回 false；如果当前节点有前驱节点，则证明它在 AQS 队列中，但是前驱节点为空，说明它是头节点，而头节点是不参与锁竞争的，也返回 false；
* 如果当前节点既不在等待队列中，又不是 AQS 中的头节点且存在 next 节点，说明它存在于 AQS 中，直接返回 true。

4、处理中断

```java
private int checkInterruptWhileWaiting(Node node) {
    return Thread.interrupted() ?
        (transferAfterCancelledWait(node) ? THROW_IE : REINTERRUPT) :
        0;
}
```

1. **先清除中断状态**（`Thread.interrupted()` 返回 true 表示当前线程被中断过）。
2. 如果确实被中断，则调用 `transferAfterCancelledWait(node)` 判断：
   - **如果返回 true** → 节点成功从条件队列转移到同步队列（说明还没被 signal）→ **`THROW_IE`**
   - **如果返回 false** → 节点**已经被 signal 转移了**（即 signal 先于中断发生）→ **`REINTERRUPT`**

```java
final boolean transferAfterCancelledWait(Node node) {
    // 尝试将节点状态从 CONDITION 改为 0（初始化状态）
    if (compareAndSetWaitStatus(node, Node.CONDITION, 0)) {
        // 成功说明：signal 还没发生！我们抢先一步取消等待，并手动入主队列
        enq(node);
        return true; // 表示“中断发生在 signal 之前”
    }
    
    // 如果 CAS 失败，说明 waitStatus 已不是 CONDITION
    // 很可能是因为 signal() 已经开始执行（把状态改成了 0 或其他）
    // 此时需等待 signal 完全完成（确保节点已入主队列）
    while (!isOnSyncQueue(node))
        Thread.yield(); // 等待 signal 线程完成转移
    
    return false; // 表示“signal 先发生，中断在其后”
}
```

5、当退出 while 循环后会调用`acquireQueued(node, savedState)`，该方法的作用是在**自旋过程中线程不断尝试获取同步状态，直到成功（线程获取到 lock）或阻塞**。

##### `signal()`/`signalAll()` 方法

先明确 `signal()` 的目标：

* 只有持有锁的线程才能唤醒锁所属的Condition等待的线程
* 优先唤醒条件队列中的第一个，如果唤醒过程中出现问题，接着找往下找，直到找到一个可以唤醒的
* 唤醒操作本质上是将条件队列中的结点直接丢进AQS同步队列中，让其参与到锁的竞争中
* 拿到锁之后，线程才能恢复运行

![image-20230306171620786](/juc-img/UjG1Dd5xNJhIyWm.png)

源码：

```java
public final void signal() {
    //1. 先检测当前线程是否已经获取lock
    if (!isHeldExclusively())
        throw new IllegalMonitorStateException();
    //2. 获取等待队列中第一个节点，之后的操作都是针对这个节点
	Node first = firstWaiter;
    if (first != null)
        doSignal(first);
}

private void doSignal(Node first) {
    do {
        if ( (firstWaiter = first.nextWaiter) == null)
            lastWaiter = null;
        //1. 将头节点从等待队列中移除
        first.nextWaiter = null;
        //2. while中transferForSignal方法对头节点做真正的处理
    } while (!transferForSignal(first) &&
                (first = firstWaiter) != null);
}

final boolean transferForSignal(Node node) {
    /*
     * If cannot change waitStatus, the node has been cancelled.
     */
	//1. 更新状态为0
    if (!compareAndSetWaitStatus(node, Node.CONDITION, 0))
        return false;

	//2.将该节点移入到同步队列中去
    Node p = enq(node);
    int ws = p.waitStatus;
    if (ws > 0 || !compareAndSetWaitStatus(p, ws, Node.SIGNAL))
        LockSupport.unpark(node.thread);
    return true;
}
```

sigllAll 与 sigal 方法的区别体现在 doSignalAll 方法上，前面我们已经知道 **doSignal 方法只会对等待队列的头节点进行操作**，doSignalAll 的源码如下：

```java
private void doSignalAll(Node first) {
    lastWaiter = firstWaiter = null;
    do {
        Node next = first.nextWaiter;
        first.nextWaiter = null;
        transferForSignal(first);
        first = next;
    } while (first != null);
}
```

该方法会将等待队列中的每一个节点都移入到同步队列中，即“通知”当前调用 `condition.await()` 方法的每一个线程。

##### 总结

await、signal 和 signalAll 方法就像一个开关，控制着线程 A（等待方）和线程 B（通知方）。它们之间的关系可以用下面这幅图来说明：

<img src="/juc-img/condition-20230816114036.png" alt="condition-20230816114036" style="zoom: 40%;" />

线程 awaitThread 先通过 `lock.lock()` 方法获取锁，成功后调用 condition.await 方法进入等待队列，而另一个线程 signalThread 通过 `lock.lock()` 方法获取锁成功后调用了 condition.signal 或者 signalAll 方法，使得线程 awaitThread 能够有机会移入到同步队列中，当其他线程释放 lock 后使得线程 awaitThread 能够有机会获取 lock，从而使得线程 awaitThread 能够从 await 方法中退出并执行后续操作。如果 awaitThread 获取 lock 失败会直接进入到同步队列。

### 自行实现锁类

要求：同一时间只能有一个线程持有锁，不要求可重入（反复加锁无视即可）

```java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        
    }

    /**
     * 自行实现一个最普通的独占锁
     * 要求：同一时间只能有一个线程持有锁，不要求可重入
     */
    private static class MyLock implements Lock {

        /**
         * 设计思路：
         * 1. 锁被占用，那么exclusiveOwnerThread应该被记录，并且state = 1
         * 2. 锁没有被占用，那么exclusiveOwnerThread为null，并且state = 0
         */
        private static class Sync extends AbstractQueuedSynchronizer {
            @Override
            protected boolean tryAcquire(int arg) {
                if(isHeldExclusively()) return true;     //无需可重入功能，如果是当前线程直接返回true
                if(compareAndSetState(0, arg)){    //CAS操作进行状态替换
                    setExclusiveOwnerThread(Thread.currentThread());    //成功后设置当前的所有者线程
                    return true;
                }
                return false;
            }

            @Override
            protected boolean tryRelease(int arg) {
                if(getState() == 0)
                    throw new IllegalMonitorStateException();   //没加锁情况下是不能直接解锁的
                if(isHeldExclusively()){     //只有持有锁的线程才能解锁
                    setExclusiveOwnerThread(null);    //设置所有者线程为null
                    setState(0);    //状态变为0
                    return true;
                }
                return false;
            }

            @Override
            protected boolean isHeldExclusively() {
                return getExclusiveOwnerThread() == Thread.currentThread();
            }

            protected Condition newCondition(){
                return new ConditionObject();    //直接用现成的
            }
        }

        private final Sync sync = new Sync();

        @Override
        public void lock() {
            sync.acquire(1);
        }

        @Override
        public void lockInterruptibly() throws InterruptedException {
            sync.acquireInterruptibly(1);
        }

        @Override
        public boolean tryLock() {
            return sync.tryAcquire(1);
        }

        @Override
        public boolean tryLock(long time, TimeUnit unit) throws InterruptedException {
            return sync.tryAcquireNanos(1, unit.toNanos(time));
        }

        @Override
        public void unlock() {
            sync.release(1);
        }

        @Override
        public Condition newCondition() {
            return sync.newCondition();
        }
    }
}
```

