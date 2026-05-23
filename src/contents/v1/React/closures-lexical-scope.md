---
id: closures-lexical-scope
topic: JavaScript fundamentals
subtopic: Closures and lexical scope
category: React
---


# Closures and lexical scope

## Overview

Closures and lexical scope are core JavaScript concepts that explain how functions access variables, how state can be preserved between function calls, and why React Hooks can sometimes use outdated values when dependency arrays are incorrect.

**Lexical scope** means that variable access is determined by where code is written in the source code, not by where a function is called from at runtime. A function can access variables declared in its own scope and in outer scopes where the function was created.

**A closure** is created when a function keeps access to variables from its surrounding lexical scope, even after the outer function has finished executing. In JavaScript, functions are closures because they are created together with references to the lexical environment around them.

Simple example:

```js
function createCounter() {
  let count = 0;

  return function increment() {
    count += 1;
    return count;
  };
}

const counter = createCounter();

console.log(counter()); // 1
console.log(counter()); // 2
console.log(counter()); // 3
```

The `increment` function still has access to `count` even after `createCounter` has returned. That preserved access is a closure.

Closures are used everywhere in JavaScript and React:

- Event handlers.
- Callback functions.
- Timers.
- Promises.
- Async functions.
- Module-level private state.
- Factory functions.
- Memoized functions.
- React component event handlers.
- `useEffect`, `useCallback`, and `useMemo`.
- Custom Hooks.
- Function components.

This topic is important for interviews because closures are one of the main reasons JavaScript behaves differently from many beginner expectations. Interviewers commonly use closure questions to test whether a candidate understands scope, variable lifetime, callback behavior, asynchronous code, loops, and React Hooks.

A strong answer should explain:

- What lexical scope means.
- What closure means.
- How closures preserve access to variables.
- How closures differ from global variables.
- How closures can emulate private state.
- Why `var` in loops can cause unexpected closure bugs.
- How `let` and `const` fix block-scope loop issues.
- Why stale closures happen in React.
- How dependency arrays, refs, and functional state updates help avoid bugs.
- How closures can retain memory when references are kept alive.

Closures are powerful, but they also require care. They can make code elegant and expressive, but they can also cause stale values, hidden state, memory retention, and confusing async behavior when misunderstood.

## Core Concepts

### Lexical Scope

Lexical scope means that the scope of a variable is based on where it is declared in the code.

Example:

```js
const globalMessage = "global";

function outer() {
  const outerMessage = "outer";

  function inner() {
    const innerMessage = "inner";

    console.log(innerMessage);
    console.log(outerMessage);
    console.log(globalMessage);
  }

  inner();
}

outer();
```

`inner` can access:

- Its own variable: `innerMessage`.
- The outer function variable: `outerMessage`.
- The global variable: `globalMessage`.

This is possible because `inner` is written inside `outer`, and `outer` is written in the global scope.

The lookup direction is from inner to outer:

```text
inner scope -> outer scope -> global scope
```

An outer scope cannot access variables declared inside an inner scope:

```js
function outer() {
  function inner() {
    const secret = "hidden";
  }

  console.log(secret); // ReferenceError
}
```

Lexical scope is also called **static scope** because it can be determined by reading the source code structure.

### Scope Chain

The **scope chain** is the chain of lexical environments that JavaScript searches when resolving a variable name.

Example:

```js
const appName = "Interview Prep";

function createLogger(prefix) {
  return function log(message) {
    console.log(`[${appName}] ${prefix}: ${message}`);
  };
}

const errorLogger = createLogger("ERROR");
errorLogger("Something failed");
```

When `log` executes, JavaScript resolves variables like this:

```text
message -> found in log's local scope
prefix -> found in createLogger's scope
appName -> found in global/module scope
console -> found in global environment
```

This chain exists because of lexical nesting.

Important interview point:

```text
The scope chain is determined when the function is created, not when it is called.
```

### Function Scope

Variables declared with `var` are function-scoped. This means they are scoped to the nearest function, not the nearest block.

```js
function example() {
  if (true) {
    var message = "hello";
  }

  console.log(message); // "hello"
}
```

Even though `message` is declared inside the `if` block, it is available throughout the function.

This is different from `let` and `const`.

### Block Scope

Variables declared with `let` and `const` are block-scoped. A block is usually code between `{` and `}`.

```js
function example() {
  if (true) {
    const message = "hello";
    console.log(message); // "hello"
  }

  console.log(message); // ReferenceError
}
```

Block scope helps prevent accidental variable reuse and fixes many classic closure bugs involving loops.

Best practice:

```text
Use const by default.
Use let when reassignment is needed.
Avoid var in modern JavaScript.
```

### Closures

A closure is a function that remembers and can access variables from its lexical scope, even when that function executes outside the scope where it was created.

Example:

```js
function makeGreeting(name) {
  return function greet() {
    return `Hello, ${name}`;
  };
}

const greetMinh = makeGreeting("Minh");

console.log(greetMinh()); // "Hello, Minh"
```

`makeGreeting` has already finished executing, but `greetMinh` still remembers `name`.

This happens because the returned function has a reference to the lexical environment where it was created.

A practical definition:

```text
Closure = function + access to its surrounding lexical environment.
```

### Closures Are Created at Function Creation Time

A closure is created when the function is created, not when it is called.

```js
function outer(value) {
  return function inner() {
    console.log(value);
  };
}

const first = outer("first");
const second = outer("second");

first();  // "first"
second(); // "second"
```

Each call to `outer` creates a new lexical environment. Each returned `inner` function closes over a different `value`.

This is why two closures created from the same function can preserve different state.

### Closures Preserve Variables, Not Just Values

Closures capture variable bindings, not only a one-time copy of primitive values.

```js
function createCounter() {
  let count = 0;

  return {
    increment() {
      count += 1;
    },
    getCount() {
      return count;
    }
  };
}

const counter = createCounter();

counter.increment();
counter.increment();

console.log(counter.getCount()); // 2
```

Both `increment` and `getCount` close over the same `count` binding. When `increment` changes `count`, `getCount` sees the updated value.

This is important:

```text
Closures preserve access to variables, not just snapshots of values in every situation.
```

However, React renders introduce a special practical case: each render creates new variables, so a callback created during an older render may close over that older render's values. This is the source of many stale closure bugs.

### Private State with Closures

Closures can emulate private state because the enclosed variable is not directly accessible from outside.

```js
function createBankAccount(initialBalance) {
  let balance = initialBalance;

  return {
    deposit(amount) {
      if (amount <= 0) {
        throw new Error("Amount must be positive");
      }

      balance += amount;
    },
    withdraw(amount) {
      if (amount > balance) {
        throw new Error("Insufficient funds");
      }

      balance -= amount;
    },
    getBalance() {
      return balance;
    }
  };
}

const account = createBankAccount(100);
account.deposit(50);

console.log(account.getBalance()); // 150
console.log(account.balance); // undefined
```

The `balance` variable is private to the closure. Consumers can only interact with it through the returned methods.

Real-world uses:

- Module-private variables.
- Factory functions.
- Encapsulated counters.
- Function-level caches.
- Controlled state access.
- Avoiding global mutable state.

### Closures and Callback Functions

Callbacks often use closures because they need access to variables from an outer function.

```js
function setupButton(button, userId) {
  button.addEventListener("click", function handleClick() {
    console.log(`Clicked by user ${userId}`);
  });
}
```

`handleClick` closes over `userId`. When the button is clicked later, the callback still has access to the user ID.

This is useful, but it also means callbacks can keep variables alive in memory as long as the callback is registered.

Best practice:

```text
Remove event listeners when they are no longer needed.
Avoid closing over large objects unnecessarily.
```

### Closures and Timers

Timers are a common closure example.

```js
function delayedLog(message) {
  setTimeout(() => {
    console.log(message);
  }, 1000);
}

delayedLog("Hello later");
```

The callback runs later, after `delayedLog` has returned. It still has access to `message` because of closure.

Common mistake with changing outer variables:

```js
let message = "first";

setTimeout(() => {
  console.log(message);
}, 1000);

message = "second";
```

This logs:

```text
second
```

The closure references the variable binding. By the time the timer runs, the binding contains the new value.

### Closures and Loops with var

A classic closure bug happens when `var` is used in loops.

```js
for (var i = 0; i < 3; i += 1) {
  setTimeout(() => {
    console.log(i);
  }, 100);
}
```

Output:

```text
3
3
3
```

Why? `var` is function-scoped, so all callbacks close over the same `i`. By the time the callbacks run, the loop has finished and `i` is `3`.

### Closures and Loops with let

Using `let` creates a new binding for each loop iteration.

```js
for (let i = 0; i < 3; i += 1) {
  setTimeout(() => {
    console.log(i);
  }, 100);
}
```

Output:

```text
0
1
2
```

Each callback closes over a different `i` binding for that loop iteration.

This is a common interview question because it tests understanding of both closures and block scope.

### IIFE and Older Closure Patterns

Before `let` and `const`, developers often used an Immediately Invoked Function Expression, or IIFE, to create a new scope.

```js
for (var i = 0; i < 3; i += 1) {
  (function (index) {
    setTimeout(() => {
      console.log(index);
    }, 100);
  })(i);
}
```

Output:

```text
0
1
2
```

The IIFE creates a new function scope for each iteration, and each callback closes over a separate `index` parameter.

Modern JavaScript usually uses `let` instead.

### Closures and Modules

JavaScript modules create their own scope. Variables declared in a module are not global by default.

```js
let token = null;

export function setToken(value) {
  token = value;
}

export function getToken() {
  return token;
}
```

`token` is module-private. Other modules cannot directly access it unless it is exported.

This is a modern alternative to older closure-based module patterns.

Older module pattern:

```js
const authStore = (function () {
  let token = null;

  return {
    setToken(value) {
      token = value;
    },
    getToken() {
      return token;
    }
  };
})();
```

This uses closure to create private state.

### Closures and Higher-Order Functions

A higher-order function is a function that receives another function, returns another function, or both.

Closures are often used with higher-order functions.

```js
function multiplyBy(factor) {
  return function (value) {
    return value * factor;
  };
}

const double = multiplyBy(2);
const triple = multiplyBy(3);

console.log(double(5)); // 10
console.log(triple(5)); // 15
```

`double` closes over `factor = 2`, while `triple` closes over `factor = 3`.

Real-world examples:

- Event handler factories.
- Middleware factories.
- Validator factories.
- Function composition.
- Currying.
- Memoization.
- React custom Hooks.

### Closures and Currying

Currying means transforming a function with multiple arguments into a sequence of functions that each take one or fewer arguments.

```js
function createUrlBuilder(baseUrl) {
  return function buildUrl(path) {
    return `${baseUrl}${path}`;
  };
}

const buildApiUrl = createUrlBuilder("https://api.example.com");

console.log(buildApiUrl("/users"));
```

The returned function remembers `baseUrl` through closure.

This is useful for preconfiguring functions.

### Closures and Memoization

Memoization stores the result of expensive calculations so repeated calls can reuse the cached result.

```js
function memoize(fn) {
  const cache = new Map();

  return function memoized(arg) {
    if (cache.has(arg)) {
      return cache.get(arg);
    }

    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}

const square = memoize((value) => {
  console.log("calculating");
  return value * value;
});

console.log(square(4)); // calculating, 16
console.log(square(4)); // 16
```

The returned `memoized` function closes over `cache` and `fn`.

Trade-offs:

- Faster repeated calls.
- More memory usage.
- Cache invalidation may be needed.
- Cache keys must be designed carefully.
- Long-lived closures can retain cache data for a long time.

### Closures and Memory Retention

Closures can keep variables alive as long as the closure itself is reachable.

```js
function createLargeClosure() {
  const largeData = new Array(1_000_000).fill("data");

  return function readFirstItem() {
    return largeData[0];
  };
}

const reader = createLargeClosure();
```

`largeData` cannot be garbage collected while `reader` is still reachable because `reader` closes over it.

This is not a memory leak by itself, but it can become one if long-lived closures keep unnecessary large data alive.

Common sources of memory retention:

- Event listeners not removed.
- Timers not cleared.
- Long-lived caches.
- Global arrays storing callbacks.
- Closures over large objects.
- React effects without cleanup.

Best practices:

- Remove event listeners in cleanup.
- Clear intervals and timeouts when needed.
- Avoid closing over large objects unnecessarily.
- Use bounded caches.
- In React, return cleanup functions from effects.

### Lexical Scope vs Dynamic Scope

JavaScript uses lexical scope, not dynamic scope.

Lexical scope means variable lookup is based on where a function is written.

Dynamic scope would mean variable lookup is based on where a function is called from. JavaScript does not work this way for normal variables.

Example:

```js
const message = "global";

function printMessage() {
  console.log(message);
}

function run() {
  const message = "local";
  printMessage();
}

run(); // "global"
```

`printMessage` was defined in the global scope, so it uses the global `message`, even though it is called from inside `run`.

This is a strong example for explaining lexical scope in interviews.

### Scope vs this

Lexical scope and `this` are different concepts.

Lexical scope controls variable lookup.

`this` is a special value determined by how a function is called, except for arrow functions, which capture `this` lexically from the surrounding scope.

Example:

```js
const user = {
  name: "Minh",
  regularFunction() {
    console.log(this.name);
  },
  arrowFunction: () => {
    console.log(this.name);
  }
};

user.regularFunction(); // "Minh"
user.arrowFunction();   // usually undefined in modules
```

Arrow functions do not have their own `this`; they close over `this` from the surrounding lexical context.

Important distinction:

```text
Closures are about variable scope.
this is about call context, except arrow functions capture this lexically.
```

### Closures and Asynchronous Code

Asynchronous callbacks often use closures.

```js
function fetchUser(userId) {
  return fetch(`/api/users/${userId}`)
    .then((response) => response.json())
    .then((user) => {
      console.log(`Loaded user ${userId}:`, user.name);
    });
}
```

The final callback closes over `userId`.

Async/await also uses closures when inner functions access outer variables:

```js
async function loadUser(userId) {
  const response = await fetch(`/api/users/${userId}`);
  const user = await response.json();

  return function printUser() {
    console.log(user.name);
  };
}
```

The returned `printUser` function closes over `user`.

Common asynchronous closure bug:

```js
function runSearch(query) {
  setTimeout(() => {
    console.log(`Searching for ${query}`);
  }, 500);
}

runSearch("react");
runSearch("javascript");
```

Each call has its own `query` binding, so this works correctly. Problems usually happen when a shared outer variable is mutated between async callbacks.

### Stale Closures

A stale closure happens when a function closes over a value from an earlier time, but later code expects it to use the newest value.

Plain JavaScript example:

```js
function createLogger() {
  let count = 0;

  const message = `Count is ${count}`;

  return {
    increment() {
      count += 1;
    },
    log() {
      console.log(message);
    }
  };
}

const logger = createLogger();
logger.increment();
logger.increment();
logger.log(); // "Count is 0"
```

`message` was calculated once when `count` was `0`. The `log` function closes over that `message`, not a dynamically recalculated message.

Fix:

```js
function createLogger() {
  let count = 0;

  return {
    increment() {
      count += 1;
    },
    log() {
      console.log(`Count is ${count}`);
    }
  };
}
```

Now `log` reads the current `count` binding when it runs.

### Closures in React Function Components

React function components are functions. Every render calls the component again and creates a new set of local variables, props references, state values, event handlers, and closures.

Example:

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    console.log(count);
    setCount(count + 1);
  }

  return <button onClick={handleClick}>Count: {count}</button>;
}
```

Each render creates a new `handleClick` function that closes over that render's `count` value.

Usually this is exactly what you want. The handler rendered to the screen corresponds to the values from that render.

Closures become tricky when callbacks are stored and executed later, such as:

- `setInterval`.
- `setTimeout`.
- Event listeners.
- Subscriptions.
- WebSocket callbacks.
- Promise callbacks.
- Effects with incomplete dependencies.
- Memoized callbacks with incorrect dependencies.

### Stale Closures in useEffect

A common React stale closure bug happens when an effect reads a value but the dependency array does not include it.

Bad:

```tsx
function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/search?q=${query}`);
      const data = await response.json();
      setResults(data);
    }

    load();
  }, []);

  return <ResultList results={results} />;
}
```

The effect closes over the initial `query`. If `query` changes, the effect does not rerun, so the component can show stale results.

Better:

```tsx
function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/search?q=${query}`);
      const data = await response.json();
      setResults(data);
    }

    load();
  }, [query]);

  return <ResultList results={results} />;
}
```

Now the effect reruns when `query` changes.

Interview point:

```text
React dependency arrays are closely related to closures. If an effect or memoized callback uses a reactive value, it usually belongs in the dependency array.
```

### Stale Closures in setInterval

Bad:

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCount(count + 1);
    }, 1000);

    return () => clearInterval(id);
  }, []);

  return <div>{count}</div>;
}
```

The interval callback closes over the initial `count`, so it repeatedly calls `setCount(0 + 1)`.

Fix with functional state update:

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((current) => current + 1);
    }, 1000);

    return () => clearInterval(id);
  }, []);

  return <div>{count}</div>;
}
```

The functional update receives the latest state value, so the interval does not need to close over `count`.

### useRef and Current Values

Sometimes a callback should not be recreated on every value change, but it still needs access to the latest value. A ref can store the latest value without causing rerenders.

```tsx
function WindowLogger({ value }: { value: string }) {
  const latestValueRef = useRef(value);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    function handleResize() {
      console.log(latestValueRef.current);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return null;
}
```

The resize listener is registered once, but it reads the latest value from the ref.

Use refs carefully. A ref can avoid stale closures, but it can also hide reactive dependencies if overused.

### useCallback and Closures

`useCallback` returns a memoized function, but the function still closes over values from the render when it was created.

Bad:

```tsx
const handleSave = useCallback(() => {
  saveUser(userId, formData);
}, [userId]);
```

If `formData` changes, `handleSave` still uses the old `formData` because it is missing from the dependency array.

Better:

```tsx
const handleSave = useCallback(() => {
  saveUser(userId, formData);
}, [userId, formData]);
```

Important:

```text
useCallback does not prevent closures. It memoizes a closure based on dependencies.
```

### useMemo and Closures

`useMemo` also depends on closures and dependencies.

Bad:

```tsx
const filteredItems = useMemo(() => {
  return items.filter((item) => item.name.includes(searchText));
}, [items]);
```

If `searchText` changes but is not included in dependencies, the memoized result can be stale.

Better:

```tsx
const filteredItems = useMemo(() => {
  return items.filter((item) => item.name.includes(searchText));
}, [items, searchText]);
```

Use `useMemo` for expensive derived values, not as a default for every calculation.

### Functional Updates in React

Functional state updates help avoid stale closures when the next state depends on the previous state.

Bad:

```tsx
setCount(count + 1);
setCount(count + 1);
```

This may only increment once because both calls use the same closed-over `count` value.

Better:

```tsx
setCount((current) => current + 1);
setCount((current) => current + 1);
```

This correctly applies two increments.

Use functional updates when:

- New state depends on previous state.
- The update happens inside timers.
- The update happens inside async callbacks.
- Multiple updates may be queued.
- You want to avoid adding state as a callback dependency only for computing next state.

### React Dependency Arrays

Dependency arrays tell React when to recreate or rerun effect, memo, or callback logic.

Examples:

```tsx
useEffect(() => {
  document.title = title;
}, [title]);
```

```tsx
const handleSubmit = useCallback(() => {
  submitForm(formData);
}, [formData]);
```

```tsx
const visibleItems = useMemo(() => {
  return items.filter((item) => item.visible);
}, [items]);
```

General rule:

```text
If a reactive value from props, state, or component scope is used inside the hook callback, it should be included in the dependency array unless there is a deliberate alternative pattern.
```

Common alternatives:

- Move code inside the effect.
- Use functional state updates.
- Use refs for latest values.
- Move stable functions outside the component.
- Use reducers for complex state transitions.
- Split effects by responsibility.

Avoid disabling dependency lint rules without understanding the closure behavior.

### Closures in Custom Hooks

Custom Hooks often return functions that close over Hook state.

```tsx
function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue((current) => !current);
  }, []);

  return { value, toggle };
}
```

`toggle` uses a functional state update, so it does not need to depend on `value`.

A bad custom Hook can expose stale closures if dependencies are incorrect:

```tsx
function useSearch(query: string) {
  const [results, setResults] = useState<string[]>([]);

  const reload = useCallback(async () => {
    const response = await fetch(`/api/search?q=${query}`);
    setResults(await response.json());
  }, []);

  return { results, reload };
}
```

Fix:

```tsx
function useSearch(query: string) {
  const [results, setResults] = useState<string[]>([]);

  const reload = useCallback(async () => {
    const response = await fetch(`/api/search?q=${query}`);
    setResults(await response.json());
  }, [query]);

  return { results, reload };
}
```

### Closures and Event Handler Factories in React

Closures are useful for creating event handlers with parameters.

```tsx
function TodoList({ todos, onToggle }: TodoListProps) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>
          <button onClick={() => onToggle(todo.id)}>
            {todo.title}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

The arrow function closes over `todo.id`.

This is normal and often fine. Avoid premature optimization. Only optimize handler creation if there is evidence of performance problems or unnecessary rerenders in memoized child components.

### Closures vs Classes

Closures can provide private state without classes.

Closure-based counter:

```js
function createCounter() {
  let count = 0;

  return {
    increment() {
      count += 1;
    },
    getCount() {
      return count;
    }
  };
}
```

Class-based counter:

```js
class Counter {
  #count = 0;

  increment() {
    this.#count += 1;
  }

  getCount() {
    return this.#count;
  }
}
```

Both can model private state. Closures are function-based. Classes are object/prototype-based and can use private fields.

Use closures when:

- You want a small factory function.
- You want to preserve local variables.
- You are writing callbacks or higher-order functions.
- You want simple private state.

Use classes when:

- You need many instances with shared prototype methods.
- You want class syntax and private fields.
- You model objects with identity and behavior.
- Your team prefers class-based patterns.

### Common Mistakes

Common closure and lexical scope mistakes include:

- Thinking scope is based on where a function is called instead of where it is defined.
- Using `var` in loops and expecting each callback to get a separate value.
- Forgetting that closures can keep variables alive in memory.
- Assuming closures always capture a frozen snapshot.
- Mutating closed-over variables in hard-to-track ways.
- Creating stale closures in React effects, callbacks, and memos.
- Omitting dependencies from React dependency arrays.
- Disabling `exhaustive-deps` without understanding the effect.
- Using refs to avoid dependencies when the effect should actually resynchronize.
- Keeping event listeners or intervals alive without cleanup.
- Closing over large objects unnecessarily.
- Confusing lexical scope with `this` binding.
- Overusing closures when a simple parameter or local variable is clearer.

### Best Practices

Use `const` by default and `let` when reassignment is needed.

Avoid `var` in modern JavaScript.

Keep closures small and focused.

Avoid hidden mutation of closed-over variables when it makes behavior hard to reason about.

Use closures for callbacks, private state, factories, and higher-order functions when they improve clarity.

Clean up event listeners, subscriptions, and intervals.

Be careful when closures retain large objects or long-lived caches.

In React, include all reactive dependencies in `useEffect`, `useCallback`, and `useMemo` dependency arrays.

Use functional state updates when the next state depends on the previous state.

Use refs when a stable callback must read the latest value without resubscribing or rerendering.

Split effects by responsibility instead of forcing one effect to handle unrelated logic.

Do not disable Hook dependency lint rules unless you can clearly explain why the closure behavior is correct.

When debugging closure issues, ask:

```text
Where was this function created?
Which variables did it close over?
Can those variables change?
Is this callback running later than expected?
In React, which render created this callback?
Are the hook dependencies complete?
```

## Common Interview Questions

<!-- interview-questions:start -->

<!-- question-group:start:beginner -->
### Beginner

<!-- question:start:closures-and-lexical-scope-beginner-q01 -->
#### Beginner Q01: What is lexical scope in JavaScript?

<!-- question-id:closures-and-lexical-scope-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

Lexical scope means that variable access is determined by where functions and variables are written in the source code. A function can access variables from its own scope and from outer scopes where the function was defined.

Example:

```js
const message = "global";

function outer() {
  const name = "Minh";

  function inner() {
    console.log(message);
    console.log(name);
  }

  inner();
}
```

`inner` can access `name` because it is written inside `outer`. It can also access `message` from the outer global or module scope.

##### Key Points to Mention

- Scope is based on source code structure.
- Inner functions can access outer variables.
- Outer functions cannot access inner variables.
- JavaScript uses lexical scope, not dynamic scope.
- Variable lookup follows the scope chain.
- Lexical scope is the foundation of closures.

<!-- question:end:closures-and-lexical-scope-beginner-q01 -->

<!-- question:start:closures-and-lexical-scope-beginner-q02 -->
#### Beginner Q02: What is a closure?

<!-- question-id:closures-and-lexical-scope-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

A closure is a function that keeps access to variables from its surrounding lexical scope, even after the outer function has finished executing.

Example:

```js
function createCounter() {
  let count = 0;

  return function increment() {
    count += 1;
    return count;
  };
}

const counter = createCounter();
console.log(counter()); // 1
console.log(counter()); // 2
```

The returned `increment` function still has access to `count`, even though `createCounter` has already returned.

##### Key Points to Mention

- Closure is function plus surrounding lexical environment.
- Created when a function is created.
- Allows functions to remember outer variables.
- Works even after the outer function returns.
- Common in callbacks, event handlers, factories, and React.
- Can preserve private state.

<!-- question:end:closures-and-lexical-scope-beginner-q02 -->

<!-- question:start:closures-and-lexical-scope-beginner-q03 -->
#### Beginner Q03: Why does a closure still access variables after the outer function returns?

<!-- question-id:closures-and-lexical-scope-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

A closure still accesses variables after the outer function returns because the inner function keeps a reference to the lexical environment where it was created. As long as the returned inner function is reachable, the variables it needs remain reachable too.

Example:

```js
function makeGreeting(name) {
  return function greet() {
    return `Hello, ${name}`;
  };
}

const greet = makeGreeting("Minh");
console.log(greet());
```

The `name` variable remains available to `greet` because `greet` closes over it.

##### Key Points to Mention

- The inner function references its lexical environment.
- Needed variables remain alive while the closure is reachable.
- The outer function's execution is finished, but its environment can still be referenced.
- This enables private state and function factories.
- It can also retain memory.

<!-- question:end:closures-and-lexical-scope-beginner-q03 -->

<!-- question:start:closures-and-lexical-scope-beginner-q04 -->
#### Beginner Q04: What is the difference between function scope and block scope?

<!-- question-id:closures-and-lexical-scope-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

Function scope means a variable is available throughout the nearest function. Variables declared with `var` are function-scoped.

Block scope means a variable is available only inside the nearest block, such as an `if`, `for`, or `{}` block. Variables declared with `let` and `const` are block-scoped.

Example:

```js
function example() {
  if (true) {
    var a = 1;
    let b = 2;
  }

  console.log(a); // 1
  console.log(b); // ReferenceError
}
```

##### Key Points to Mention

- `var` is function-scoped.
- `let` and `const` are block-scoped.
- Block scope helps prevent accidental access.
- `let` and `const` fix many loop closure bugs.
- Modern JavaScript usually avoids `var`.

<!-- question:end:closures-and-lexical-scope-beginner-q04 -->

<!-- question:start:closures-and-lexical-scope-beginner-q05 -->
#### Beginner Q05: How can closures create private variables?

<!-- question-id:closures-and-lexical-scope-beginner-q05 -->
<!-- question-level:beginner -->

##### Expected Answer

Closures can create private variables by keeping variables inside an outer function and returning methods that access those variables. Code outside the outer function cannot directly access the variables.

Example:

```js
function createCounter() {
  let count = 0;

  return {
    increment() {
      count += 1;
    },
    getCount() {
      return count;
    }
  };
}

const counter = createCounter();
counter.increment();
console.log(counter.getCount()); // 1
console.log(counter.count); // undefined
```

`count` is private because only the returned methods can access it.

##### Key Points to Mention

- Variables inside the outer function are not directly accessible.
- Returned functions close over those variables.
- Useful for encapsulation.
- Avoids global state.
- Classes with private fields are another modern option.

<!-- question:end:closures-and-lexical-scope-beginner-q05 -->

<!-- question:start:closures-and-lexical-scope-beginner-q06 -->
#### Beginner Q06: What will this code print and why?

<!-- question-id:closures-and-lexical-scope-beginner-q06 -->
<!-- question-level:beginner -->

```js
for (var i = 0; i < 3; i += 1) {
  setTimeout(() => {
    console.log(i);
  }, 100);
}
```

##### Expected Answer

It prints:

```text
3
3
3
```

`var` is function-scoped, so all three callbacks close over the same `i` variable. By the time the callbacks execute, the loop has finished and `i` is `3`.

Using `let` fixes it because `let` creates a new binding for each loop iteration.

```js
for (let i = 0; i < 3; i += 1) {
  setTimeout(() => {
    console.log(i);
  }, 100);
}
```

This prints `0`, `1`, and `2`.

##### Key Points to Mention

- `var` is function-scoped.
- All callbacks share the same `i`.
- Timer callbacks run after the loop completes.
- `let` creates a new binding per iteration.
- This is a classic closure interview question.

<!-- question:end:closures-and-lexical-scope-beginner-q06 -->

<!-- question-group:end:beginner -->

<!-- question-group:start:intermediate -->
### Intermediate

<!-- question:start:closures-and-lexical-scope-intermediate-q01 -->
#### Intermediate Q01: What is a stale closure?

<!-- question-id:closures-and-lexical-scope-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

A stale closure happens when a function closes over a value from an earlier time, but later code expects it to use a newer value.

Example:

```js
function createLogger() {
  let count = 0;
  const message = `Count is ${count}`;

  return {
    increment() {
      count += 1;
    },
    log() {
      console.log(message);
    }
  };
}

const logger = createLogger();
logger.increment();
logger.log(); // "Count is 0"
```

`message` was created when `count` was `0`, so `log` uses the old message.

In React, stale closures often happen when `useEffect`, `useCallback`, or `useMemo` has an incomplete dependency array.

##### Key Points to Mention

- Function uses an older closed-over value.
- Common with async callbacks, timers, and React Hooks.
- In React, each render creates new values and closures.
- Missing dependencies often cause stale closures.
- Fix with correct dependencies, functional updates, or refs.

<!-- question:end:closures-and-lexical-scope-intermediate-q01 -->

<!-- question:start:closures-and-lexical-scope-intermediate-q02 -->
#### Intermediate Q02: How do closures relate to React Hooks?

<!-- question-id:closures-and-lexical-scope-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

React function components are JavaScript functions, so each render creates new local variables and new closures. Event handlers, effects, memoized callbacks, and custom Hook functions close over the props and state from the render where they were created.

This is useful because handlers naturally access component state. However, it can cause stale closures if a callback runs later and was created with old values.

Example:

```tsx
useEffect(() => {
  const id = setInterval(() => {
    console.log(count);
  }, 1000);

  return () => clearInterval(id);
}, []);
```

This interval logs the initial `count` because the effect was created during the initial render and does not rerun.

##### Key Points to Mention

- Function components create closures each render.
- Effects and callbacks close over render values.
- Hooks rely on normal JavaScript closures.
- Missing dependencies can cause stale values.
- Dependency arrays control when effects/callbacks are recreated.
- Functional updates and refs can help in specific cases.

<!-- question:end:closures-and-lexical-scope-intermediate-q02 -->

<!-- question:start:closures-and-lexical-scope-intermediate-q03 -->
#### Intermediate Q03: How do you fix stale state inside `setInterval` in React?

<!-- question-id:closures-and-lexical-scope-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use a functional state update when the next state depends on the previous state.

Bad:

```tsx
useEffect(() => {
  const id = setInterval(() => {
    setCount(count + 1);
  }, 1000);

  return () => clearInterval(id);
}, []);
```

This closes over the initial `count`.

Good:

```tsx
useEffect(() => {
  const id = setInterval(() => {
    setCount((current) => current + 1);
  }, 1000);

  return () => clearInterval(id);
}, []);
```

The functional update receives the latest state value, so the interval callback does not need to close over `count`.

##### Key Points to Mention

- Timer callbacks can close over old state.
- Functional updates receive the latest state.
- Good when next state depends on previous state.
- Cleanup the interval.
- Alternative is to include dependencies and recreate the interval, but functional update is often cleaner for counters.

<!-- question:end:closures-and-lexical-scope-intermediate-q03 -->

<!-- question:start:closures-and-lexical-scope-intermediate-q04 -->
#### Intermediate Q04: Why should dependencies be included in `useEffect`, `useCallback`, and `useMemo`?

<!-- question-id:closures-and-lexical-scope-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Dependencies tell React when to rerun an effect or recreate a memoized value or callback. If a hook uses props, state, or variables from the component scope but they are missing from the dependency array, the hook may use stale values from an older render.

Example:

```tsx
useEffect(() => {
  fetch(`/api/search?q=${query}`);
}, []);
```

If `query` changes, this effect does not rerun and still uses the initial `query`.

Correct:

```tsx
useEffect(() => {
  fetch(`/api/search?q=${query}`);
}, [query]);
```

##### Key Points to Mention

- Hooks close over render values.
- Dependency arrays control reruns or recreation.
- Missing dependencies can cause stale closures.
- Include reactive values used inside the hook.
- Use functional updates or refs only when they correctly model the behavior.
- Avoid disabling dependency lint rules without understanding the closure.

<!-- question:end:closures-and-lexical-scope-intermediate-q04 -->

<!-- question:start:closures-and-lexical-scope-intermediate-q05 -->
#### Intermediate Q05: When should you use a ref to avoid stale closures in React?

<!-- question-id:closures-and-lexical-scope-intermediate-q05 -->
<!-- question-level:intermediate -->

##### Expected Answer

Use a ref when a stable callback must read the latest value without causing the callback or effect to be recreated on every value change.

Example:

```tsx
function Logger({ value }: { value: string }) {
  const latestValue = useRef(value);

  useEffect(() => {
    latestValue.current = value;
  }, [value]);

  useEffect(() => {
    function onResize() {
      console.log(latestValue.current);
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
}
```

The event listener is registered once, but it reads the latest value from the ref.

##### Key Points to Mention

- Refs persist across renders.
- Updating a ref does not cause rerender.
- Useful for event listeners, subscriptions, and timers.
- Good when you need latest value without resubscribing.
- Do not use refs to hide dependencies when the effect should resynchronize.
- Keep ref usage intentional.

<!-- question:end:closures-and-lexical-scope-intermediate-q05 -->

<!-- question:start:closures-and-lexical-scope-intermediate-q06 -->
#### Intermediate Q06: Do closures capture values or variables?

<!-- question-id:closures-and-lexical-scope-intermediate-q06 -->
<!-- question-level:intermediate -->

##### Expected Answer

Closures capture variable bindings from their lexical environment, not simply frozen copies of values in every case.

Example:

```js
function createCounter() {
  let count = 0;

  return {
    increment() {
      count += 1;
    },
    getCount() {
      return count;
    }
  };
}
```

Both methods access the same `count` binding. When `increment` changes `count`, `getCount` sees the updated value.

However, if you compute another value once, such as `const message = `Count is ${count}``, then a closure over `message` will keep that computed value until it is recalculated.

##### Key Points to Mention

- Closures capture bindings.
- Multiple closures can share the same binding.
- Mutating the binding can be visible to all closures.
- Computed values can become stale if calculated once.
- React renders create new bindings for each render.
- This distinction explains many stale closure bugs.

<!-- question:end:closures-and-lexical-scope-intermediate-q06 -->

<!-- question:start:closures-and-lexical-scope-intermediate-q07 -->
#### Intermediate Q07: How can closures cause memory issues?

<!-- question-id:closures-and-lexical-scope-intermediate-q07 -->
<!-- question-level:intermediate -->

##### Expected Answer

Closures can keep variables alive as long as the closure is still reachable. If a closure references a large object, cache, DOM node, or subscription data, that data may not be garbage collected while the closure remains registered or stored.

Example:

```js
function createReader() {
  const largeData = new Array(1_000_000).fill("data");

  return function read() {
    return largeData[0];
  };
}

const reader = createReader();
```

`largeData` remains reachable through `reader`.

In React, memory issues can happen if effects register event listeners or intervals and do not clean them up.

##### Key Points to Mention

- Closures keep referenced lexical environments alive.
- Long-lived callbacks can retain memory.
- Event listeners and intervals should be cleaned up.
- Avoid closing over large objects unnecessarily.
- Use bounded caches.
- React effects should return cleanup functions when needed.

<!-- question:end:closures-and-lexical-scope-intermediate-q07 -->

<!-- question:start:closures-and-lexical-scope-intermediate-q08 -->
#### Intermediate Q08: What is the difference between lexical scope and `this`?

<!-- question-id:closures-and-lexical-scope-intermediate-q08 -->
<!-- question-level:intermediate -->

##### Expected Answer

Lexical scope controls how normal variables are resolved based on where code is written. `this` is a special value that usually depends on how a function is called. Arrow functions are different because they do not have their own `this`; they capture `this` from the surrounding lexical scope.

Example:

```js
const user = {
  name: "Minh",
  regular() {
    console.log(this.name);
  },
  arrow: () => {
    console.log(this.name);
  }
};

user.regular(); // "Minh"
user.arrow();   // usually undefined in modules
```

Closures are about variable access. `this` is about call context, except with arrow functions.

##### Key Points to Mention

- Lexical scope is about variable lookup.
- `this` usually depends on call site.
- Arrow functions capture `this` lexically.
- Closures are not the same as `this` binding.
- Confusing the two causes common JavaScript bugs.

<!-- question:end:closures-and-lexical-scope-intermediate-q08 -->

<!-- question-group:end:intermediate -->

<!-- question-group:start:advanced -->
### Advanced

<!-- question:start:closures-and-lexical-scope-advanced-q01 -->
#### Advanced Q01: Explain how closures work using lexical environments.

<!-- question-id:closures-and-lexical-scope-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

When JavaScript creates a function, the function is associated with the lexical environment where it was created. That lexical environment contains bindings for variables in that scope and a reference to the outer lexical environment. When the function later executes, variable lookup uses that environment chain.

If the function is returned or stored somewhere, the environment it references can remain alive after the outer function returns.

Example:

```js
function outer(value) {
  return function inner() {
    return value;
  };
}

const fn = outer("hello");
console.log(fn());
```

`inner` has access to `value` because it references the lexical environment created for that call to `outer`.

##### Key Points to Mention

- Functions are created with a reference to their lexical environment.
- A lexical environment stores identifier bindings.
- It also references an outer environment.
- Variable lookup follows the environment chain.
- Environments can stay alive if closures reference them.
- Each function call can create a new environment.

<!-- question:end:closures-and-lexical-scope-advanced-q01 -->

<!-- question:start:closures-and-lexical-scope-advanced-q02 -->
#### Advanced Q02: Why do React function components commonly create stale closures?

<!-- question-id:closures-and-lexical-scope-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

React function components create stale closures because each render is a new function execution with new props, state values, local variables, and callback functions. A callback created during an older render closes over that render's values. If the callback executes later, it may read values that are no longer current.

This commonly happens in effects, intervals, subscriptions, event listeners, promises, and memoized callbacks with incomplete dependency arrays.

Example:

```tsx
useEffect(() => {
  const id = setInterval(() => {
    console.log(count);
  }, 1000);

  return () => clearInterval(id);
}, []);
```

The interval logs the initial `count` because the effect runs only once and the callback closes over the initial render.

##### Key Points to Mention

- Every render creates a new lexical scope.
- Callbacks close over values from the render that created them.
- Delayed callbacks may use old render values.
- Missing hook dependencies are a common cause.
- Fix with dependencies, functional state updates, refs, or effect restructuring.
- Stale closures are JavaScript behavior, not a React-specific scope rule.

<!-- question:end:closures-and-lexical-scope-advanced-q02 -->

<!-- question:start:closures-and-lexical-scope-advanced-q03 -->
#### Advanced Q03: How would you decide between adding dependencies, using a functional update, or using a ref in React?

<!-- question-id:closures-and-lexical-scope-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

If an effect or callback must resynchronize when a value changes, include the value in the dependency array. If the next state only depends on the previous state, use a functional state update. If a stable callback needs to read the latest value without resubscribing or recreating the callback, use a ref.

Examples:

```tsx
// Resynchronize when query changes
useEffect(() => {
  fetchResults(query);
}, [query]);
```

```tsx
// Previous state update
setCount((current) => current + 1);
```

```tsx
// Stable listener reads latest value
const latestValue = useRef(value);
latestValue.current = value;
```

The right choice depends on the behavior you want, not on avoiding the linter.

##### Key Points to Mention

- Add dependencies when logic should rerun with new values.
- Use functional updates for next state from previous state.
- Use refs for stable callbacks that need latest values.
- Do not use refs to hide real dependencies.
- Split effects when they synchronize different things.
- The intended synchronization behavior should drive the choice.

<!-- question:end:closures-and-lexical-scope-advanced-q03 -->

<!-- question:start:closures-and-lexical-scope-advanced-q04 -->
#### Advanced Q04: How can you debug a stale closure bug?

<!-- question-id:closures-and-lexical-scope-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Start by identifying where the callback was created and when it executes. Then identify which variables it closes over. In React, determine which render created the callback and whether the callback's dependency array is complete.

Steps:

1. Find the delayed or stored callback.
2. Check which props, state, and variables it reads.
3. Check whether those values can change.
4. Check the dependency array if it is inside a Hook.
5. Add logs to show render values and callback values.
6. Fix by adding dependencies, using functional updates, using refs, or restructuring the effect.

Do not immediately silence the dependency warning. The warning often points to the stale closure source.

##### Key Points to Mention

- Find where the function is created.
- Find when it runs.
- Identify closed-over variables.
- In React, identify which render created it.
- Check dependencies.
- Use logs or debugger to compare current vs captured values.
- Fix based on intended behavior.

<!-- question:end:closures-and-lexical-scope-advanced-q04 -->

<!-- question:start:closures-and-lexical-scope-advanced-q05 -->
#### Advanced Q05: How does closure-based memoization work and what are the trade-offs?

<!-- question-id:closures-and-lexical-scope-advanced-q05 -->
<!-- question-level:advanced -->

##### Expected Answer

Closure-based memoization stores a cache in an outer function and returns an inner function that checks the cache before computing the result.

Example:

```js
function memoize(fn) {
  const cache = new Map();

  return function memoized(arg) {
    if (cache.has(arg)) {
      return cache.get(arg);
    }

    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}
```

The returned `memoized` function closes over `cache` and `fn`.

Trade-offs include increased memory usage, cache invalidation complexity, key equality issues, and possible memory retention if the memoized function lives for a long time.

##### Key Points to Mention

- Cache is stored in an outer lexical scope.
- Returned function closes over the cache.
- Improves repeated calculation performance.
- Uses additional memory.
- Needs good cache key design.
- May need eviction or invalidation.
- Long-lived closures can retain cached data.

<!-- question:end:closures-and-lexical-scope-advanced-q05 -->

<!-- question:start:closures-and-lexical-scope-advanced-q06 -->
#### Advanced Q06: What is the difference between a closure and a global variable?

<!-- question-id:closures-and-lexical-scope-advanced-q06 -->
<!-- question-level:advanced -->

##### Expected Answer

A global variable is accessible from many places in the program, which can make state harder to control. A closure can preserve state in a private lexical environment and expose only selected functions that can read or modify it.

Example:

```js
function createCounter() {
  let count = 0;

  return {
    increment() {
      count += 1;
    },
    getCount() {
      return count;
    }
  };
}
```

`count` is not global. It is private to one counter instance. Multiple counters can have independent state.

##### Key Points to Mention

- Globals are broadly accessible.
- Closures can encapsulate private state.
- Multiple closures can have independent environments.
- Closures reduce global namespace pollution.
- Long-lived closures still need memory care.
- Module scope can also provide private state in modern JavaScript.

<!-- question:end:closures-and-lexical-scope-advanced-q06 -->

<!-- question:start:closures-and-lexical-scope-advanced-q07 -->
#### Advanced Q07: How do closures affect performance and memory?

<!-- question-id:closures-and-lexical-scope-advanced-q07 -->
<!-- question-level:advanced -->

##### Expected Answer

Closures are normal and efficient enough for everyday JavaScript, but they can affect memory because closed-over variables remain reachable as long as the closure is reachable. Creating many short-lived closures is usually fine, but long-lived closures that capture large objects, DOM nodes, caches, or subscriptions can retain memory longer than expected.

Performance issues may also appear if closures are recreated frequently and passed to memoized child components, but this should be optimized only when it causes real problems.

In React, the bigger practical issue is often correctness through stale closures, not raw closure creation cost.

##### Key Points to Mention

- Closures are normal in JavaScript.
- Closed-over variables can remain in memory.
- Event listeners and timers need cleanup.
- Large captured objects can cause memory retention.
- Avoid premature performance optimization.
- React stale closure correctness is often more important than closure allocation cost.
- Use profiling before optimizing.

<!-- question:end:closures-and-lexical-scope-advanced-q07 -->

<!-- question:start:closures-and-lexical-scope-advanced-q08 -->
#### Advanced Q08: How would you explain closures to a developer coming from C#?

<!-- question-id:closures-and-lexical-scope-advanced-q08 -->
<!-- question-level:advanced -->

##### Expected Answer

I would explain that closures in JavaScript are similar to lambdas in C# that capture local variables. A function can be returned or passed around while still accessing variables from the scope where it was created.

JavaScript uses closures heavily because functions are first-class values. Event handlers, callbacks, promises, and React components all rely on this behavior.

Example:

```js
function multiplyBy(factor) {
  return function (value) {
    return value * factor;
  };
}

const double = multiplyBy(2);
console.log(double(5)); // 10
```

The returned function captures `factor`, similar to how a C# lambda can capture a local variable.

##### Key Points to Mention

- Similar to captured variables in C# lambdas.
- JavaScript functions are first-class values.
- Returned functions can keep outer variables alive.
- Used in callbacks and event handlers.
- React Hooks rely on closures.
- Be careful with stale values and loop variables.

<!-- question:end:closures-and-lexical-scope-advanced-q08 -->

<!-- question:start:closures-and-lexical-scope-advanced-q09 -->
#### Advanced Q09: Why is disabling React's exhaustive dependency rule risky?

<!-- question-id:closures-and-lexical-scope-advanced-q09 -->
<!-- question-level:advanced -->

##### Expected Answer

Disabling the exhaustive dependency rule is risky because it can hide stale closure bugs. If an effect, memo, or callback reads a reactive value but that value is missing from the dependency array, React may continue using an older closure even after the value changes.

Sometimes the correct fix is not simply adding a dependency. The effect may need to be split, the state update may need to use a functional update, or the latest value may need to be stored in a ref. But the warning should be treated as a design signal, not ignored by default.

##### Key Points to Mention

- Missing dependencies can cause stale closures.
- The lint rule catches many real bugs.
- Disabling it can hide synchronization problems.
- Adding dependencies is often correct.
- Functional updates or refs may be better in specific cases.
- Restructure effects instead of fighting the dependency array.
- Disable only with a clear reason.

<!-- question:end:closures-and-lexical-scope-advanced-q09 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
