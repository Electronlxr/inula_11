import type {VNode} from './Types';

// 当前处理的classVNode，用于设置inst.refs
let processingClassVNode: VNode | null = null;
export function getProcessingClassVNode(): VNode | null {
  return processingClassVNode;
}
export function setProcessingClassVNode(vNode: VNode | null) {
  processingClassVNode = vNode;
}

// capture阶段正在处理的VNode
let processingVNode: VNode | null = null;
export function getProcessingVNode() {
  return processingVNode;
}
export function setProcessingVNode(vNode: VNode | null) {
  processingVNode = vNode;
}

// 计算出来的刷新节点，不一定是根节点
let startVNode: VNode | null = null;
export function getStartVNode(): VNode | null {
  return startVNode;
}
export function setStartVNode(vNode: VNode | null) {
  startVNode = vNode;
}

type BuildVNodeResult = 0 | 1 | 2 | 3;
export const BuildInComplete = 0;
export const BuildFatalErrored = 1;
export const BuildErrored = 2;
export const BuildCompleted = 3;
// 根节点退出build tree时的状态，如: completed, incomplete, errored, fatalErrored.
let buildVNodeResult: BuildVNodeResult = BuildInComplete;
export function setBuildResult(result: BuildVNodeResult) {
  buildVNodeResult = result;
}

export function getBuildResult(): BuildVNodeResult {
  return buildVNodeResult;
}
