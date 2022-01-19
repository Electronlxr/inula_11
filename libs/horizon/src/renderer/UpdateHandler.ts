import type { VNode } from './Types';
import { FlagUtils, ShouldCapture } from './vnode/VNodeFlags';

export type Update = {
  type: 'Update' | 'Override' | 'ForceUpdate' | 'Error';
  content: any;
  callback: Callback | null;
};

export type Callback = () => any;

export type Updates = Array<Update> | null;

export enum UpdateState {
  Update = 'Update',
  Override = 'Override',
  ForceUpdate = 'ForceUpdate',
  Error = 'Error',
}

// 初始化更新数组
export function createUpdateArray(vNode: VNode): void {
  vNode.updates = []; // 新产生的update会加入这个数组
}

// 创建update对象
export function newUpdate(): Update {
  return {
    type: UpdateState.Update, // 更新的类型
    content: null, // ClassComponent的content是setState第一个参数，TreeRoot的content是HorizonDOM.render的第一个参数
    callback: null, // setState的第二个参数，HorizonDOM.render的第三个参数
  };
}

// 将update对象加入updates
export function pushUpdate(vNode: VNode, update: Update) {
  const updates = vNode.updates;

  updates?.push(update);
}

// 根据update获取新的state
function calcState(
  vNode: VNode,
  update: Update,
  inst: any,
  oldState: any,
  props: any,
): any {
  switch (update.type) {
    case UpdateState.Override:
      const content = update.content;
      return typeof content === 'function' ? content.call(inst, oldState, props) : content;
    case UpdateState.ForceUpdate:
      vNode.isForceUpdate = true;
      return oldState;
    case UpdateState.Error:
      FlagUtils.removeFlag(vNode, ShouldCapture);
      FlagUtils.markDidCapture(vNode);
    case UpdateState.Update:
      const updateContent = update.content;
      const newState = typeof updateContent === 'function' ? updateContent.call(inst, oldState, props) : updateContent;
      return (newState === null || newState === undefined)
        ? oldState
        : { ...oldState, ...newState };
    default:
      return oldState;
  }
}

// 收集callback
function collectCallbacks(vNode: VNode, update: Update) {
  if (update.callback !== null) {
    FlagUtils.markCallback(vNode);
    vNode.stateCallbacks.push(update.callback);
  }
}

// 遍历处理updates, 更新vNode的state
function calcUpdates(vNode: VNode, props: any, inst: any, toProcessUpdates: Updates) {
  let newState = vNode.state;

  toProcessUpdates.forEach(update => {
    newState = calcState(vNode, update, inst, newState, props);
    collectCallbacks(vNode, update);
  });

  vNode.shouldUpdate = false;
  vNode.state = newState;
}

// 将待更新的队列，添加到updates的尾部
export function processUpdates(vNode: VNode, inst: any, props: any): void {
  const updates: Updates = vNode.updates;
  vNode.isForceUpdate = false;

  const toProcessUpdates = [...updates];
  updates.length = 0;

  if (toProcessUpdates.length) {
    calcUpdates(vNode, props, inst, toProcessUpdates);
  }
}

export function pushForceUpdate(vNode: VNode) {
  const update = newUpdate();
  update.type = UpdateState.ForceUpdate;
  pushUpdate(vNode, update);
}
