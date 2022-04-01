import type {VNode} from '../Types';

import {
  getLastTimeHook,
  setLastTimeHook,
  setProcessingVNode,
  setCurrentHook, getNextHook
} from './BaseHook';
import {HookStage, setHookStage} from './HookStage';

// hook对外入口
export function runFunctionWithHooks<Props extends Record<string, any>, Arg>(
  funcComp: (props: Props, arg: Arg) => any,
  props: Props,
  arg: Arg,
  processing: VNode,
) {
  // 重置全局变量
  resetGlobalVariable();

  setProcessingVNode(processing);

  processing.oldHooks = processing.hooks;
  processing.hooks = [];
  processing.effectList = [];

  // 设置hook阶段
  if (processing.isCreated || !processing.oldHooks!.length) {
    setHookStage(HookStage.Init);
  } else {
    setHookStage(HookStage.Update);
  }

  const comp = funcComp(props, arg);

  // 设置hook阶段为null，用于判断hook是否在函数组件中调用
  setHookStage(null);

  // 判断hook是否写在了if条件中，如果在if中会出现数量不对等的情况
  const lastTimeHook = getLastTimeHook();
  if (lastTimeHook !== null) {
    if (getNextHook(getLastTimeHook(), processing.oldHooks) !== null) {
      throw Error('Hooks are less than expected, please check whether the hook is written in the condition.');
    }
  }

  // 重置全局变量
  resetGlobalVariable();

  return comp;
}

function resetGlobalVariable() {
  setHookStage(null);
  setProcessingVNode(null);
  setLastTimeHook(null);
  setCurrentHook(null);
}

