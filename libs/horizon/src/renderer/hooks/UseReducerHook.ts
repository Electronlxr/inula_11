import type {Hook, Reducer, Trigger, Update} from './HookType';
import {
  createHook,
  getCurrentHook,
  getProcessingVNode,
  throwNotInFuncError
} from './BaseHook';
import {
  launchUpdateFromVNode
} from '../TreeBuilder';
import {isSame} from '../utils/compare';
import {setStateChange} from '../render/FunctionComponent';
import {getHookStage, HookStage} from './HookStage';
import type {VNode} from '../Types';

export function useReducerImpl<S, P, A>(reducer: (S, A) => S, initArg: P, init?: (P) => S, isUseState?: boolean): [S, Trigger<A>] {
  const stage = getHookStage();
  if (stage === null) {
    throwNotInFuncError();
  }

  if (stage === HookStage.Init) {
    return useReducerForInit(reducer, initArg, init, isUseState);
  } else if (stage === HookStage.Update) {
    // 获取当前的hook
    const currentHook = getCurrentHook();
    // 获取currentHook的更新数组
    const currentHookUpdates = (currentHook.state as Reducer<S, A>).updates;

    return updateReducerHookState(currentHookUpdates, currentHook, reducer);
  }
}

// 构造新的Update数组
function insertUpdate<S, A>(action: A, hook: Hook<S, A>): Update<S, A> {
  const newUpdate: Update<S, A> = {
    action,
    state: null,
    didCalculated: false,
  };

  let updates = (hook.state as Reducer<S, A>).updates;
  // 更新updates数组，newUpdate添加至数组尾部
  if (updates === null) {
    updates = [newUpdate];
    (hook.state as Reducer<S, A>).updates = updates;
  } else {
    updates.push(newUpdate);
  }

  return newUpdate;
}

// setState, setReducer触发函数
export function TriggerAction<S, A, T>(vNode: VNode, hook: Hook<S, A>, action: A) {
  const newUpdate = insertUpdate(action, hook);

  // 判断是否需要刷新
  if (!vNode.shouldUpdate) {
    const reducerObj = hook.state as Reducer<S, A>;
    const { stateValue, reducer } = reducerObj;

    // 在进入render阶段前reducer没有变化，可以复用state值，提升性能
    newUpdate.state = reducer(stateValue, action);
    // 标记为已经计算过，不需要重新计算了
    newUpdate.didCalculated = true;

    if (isSame(newUpdate.state, stateValue)) {
      return;
    }
  }

  // 执行vNode节点渲染
  launchUpdateFromVNode(vNode);
}

export function useReducerForInit<S, A>(reducer, initArg, init, isUseState?: boolean): [S, Trigger<A>] {
  // 计算初始stateValue
  let stateValue;
  if (typeof initArg === 'function') {
    stateValue = initArg();
  } else if (typeof init === 'function') {
    stateValue = init(initArg);
  } else {
    stateValue = initArg;
  }

  const hook = createHook();
  // 为hook.state赋值{状态值, 触发函数, reducer, updates更新数组, 是否是useState}
  hook.state = {
    stateValue: stateValue,
    trigger: TriggerAction.bind(null, getProcessingVNode(), hook),
    reducer,
    updates: null,
    isUseState
  } as Reducer<S, A>;

  return [hook.state.stateValue, hook.state.trigger];
}

// 更新hook.state
function updateReducerHookState<S, A>(currentHookUpdates, currentHook, reducer): [S, Trigger<A>] {
  if (currentHookUpdates !== null) {
    // 循环遍历更新数组，计算新的状态值
    const newState = calculateNewState(currentHookUpdates, currentHook, reducer);
    if (!isSame(newState, currentHook.state.stateValue)) {
      setStateChange(true);
    }

    // 更新hook对象状态值
    currentHook.state.stateValue = newState;
    // 重置更新数组为null
    currentHook.state.updates = null;
  }

  currentHook.state.reducer = reducer;
  return [currentHook.state.stateValue, currentHook.state.trigger];
}

// 计算stateValue值
function calculateNewState<S, A>(currentHookUpdates: Array<Update<S, A>>, currentHook, reducer: (S, A) => S) {
  let reducerObj = currentHook.state;
  let state = reducerObj.stateValue;

  // 循环遍历更新数组，计算新的状态值
  currentHookUpdates.forEach(update => {
    // 1. didCalculated = true 说明state已经计算过; 2. 如果来自 isUseState
    if (update.didCalculated && reducerObj.isUseState) {
      state = update.state;
    } else {
      const action = update.action;
      state = reducer(state, action);
    }
  });

  return state;
}


