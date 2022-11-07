/*
 * Copyright (c) 2020 Huawei Technologies Co.,Ltd.
 *
 * openGauss is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *
 *          http://license.coscl.org.cn/MulanPSL2
 *
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import type { VNode } from '../Types';
import { FlagUtils } from '../vnode/VNodeFlags';
import { TYPE_COMMON_ELEMENT, TYPE_FRAGMENT, TYPE_PORTAL } from '../../external/JSXElementType';
import { DomText, DomPortal, Fragment, DomComponent } from '../vnode/VNodeTags';
import {
  updateVNode,
  createVNodeFromElement,
  createFragmentVNode,
  createPortalVNode,
  createDomTextVNode,
} from '../vnode/VNodeCreator';
import { isSameType, getIteratorFn, isTextType, isIteratorType, isObjectType } from './DiffTools';
import { travelChildren } from '../vnode/VNodeUtils';
import { markVNodePath } from '../utils/vNodePath';

enum DiffCategory {
  TEXT_NODE = 'TEXT_NODE',
  OBJECT_NODE = 'OBJECT_NODE',
  ARR_NODE = 'ARR_NODE',
}

type AppendVNode = (vnode: VNode) => void;
interface DiffRightSideResult {
  rightIdx: number;
  rightEndOldNode: VNode;
  rightNewNode: VNode | null;
}

// 检查是不是被 FRAGMENT 包裹
function isNoKeyFragment(child: any) {
  return child != null && child.type === TYPE_FRAGMENT && child.key === null;
}

// 清除单个节点
function deleteVNode(parentNode: VNode, delVNode: VNode): void {
  FlagUtils.setDeletion(delVNode);
  if (parentNode.dirtyNodes === null) {
    parentNode.dirtyNodes = [delVNode];
    return;
  }
  parentNode.dirtyNodes.push(delVNode);
}

// 清除多个节点
function deleteVNodes(parentVNode: VNode, startDelVNode: VNode | null, endVNode?: VNode): void {
  let node = startDelVNode;

  while (node !== null) {
    if (node === endVNode) {
      return;
    }

    deleteVNode(parentVNode, node);

    node = node.next;
  }
}

function checkCanReuseNode(oldNode: VNode | null, newChild: any, newNodeIdx: number): boolean {
  if (newChild === null) {
    return false;
  }

  const oldKey = oldNode !== null ? oldNode.key : null;
  if (isTextType(newChild)) {
    return oldKey === null;
  }

  if (isObjectType(newChild)) {
    if (Array.isArray(newChild) || isIteratorType(newChild)) {
      return oldKey === null;
    }
    if (newChild.vtype === TYPE_COMMON_ELEMENT || newChild.vtype === TYPE_PORTAL) {
      // key存在时用key判断复用
      if (oldKey !== null || newChild.key !== null) {
        return oldKey === newChild.key;
      } else {
        // 新旧节点的index应该相同才能复用，null会影响位置
        return oldNode?.eIndex === newNodeIdx;
      }
    }
  }

  return false;
}

function getNodeType(newChild: any): string | null {
  if (newChild === null) {
    return null;
  }
  if (isTextType(newChild)) {
    return DiffCategory.TEXT_NODE;
  }
  if (isObjectType(newChild)) {
    if (Array.isArray(newChild) || isIteratorType(newChild)) {
      return DiffCategory.ARR_NODE;
    }
    if (newChild.vtype === TYPE_COMMON_ELEMENT || newChild.vtype === TYPE_PORTAL) {
      return DiffCategory.OBJECT_NODE;
    }
  }
  return null;
}

// 设置vNode的flag
function setVNodeAdditionFlag(newNode: VNode) {
  if (newNode.isCreated) {
    // 位置 小于 上一个复用的位置
    // 标记为新增
    FlagUtils.setAddition(newNode);
  }
}

// 获取新节点
function getNewNode(parentNode: VNode, newChild: any, oldNode: VNode | null) {
  const newNodeType = getNodeType(newChild);
  if (newNodeType === null) {
    return null;
  }

  let resultNode: VNode | null = null;
  switch (newNodeType) {
    case DiffCategory.TEXT_NODE: {
      if (oldNode === null || oldNode.tag !== DomText) {
        resultNode = createDomTextVNode(String(newChild));
      } else {
        resultNode = updateVNode(oldNode, String(newChild));
      }
      break;
    }
    case DiffCategory.ARR_NODE: {
      if (oldNode === null || oldNode.tag !== Fragment) {
        resultNode = createFragmentVNode(null, newChild);
      } else {
        resultNode = updateVNode(oldNode, newChild);
      }
      break;
    }
    case DiffCategory.OBJECT_NODE: {
      if (newChild.vtype === TYPE_COMMON_ELEMENT) {
        if (newChild.type === TYPE_FRAGMENT) {
          if (oldNode === null || oldNode.tag !== Fragment) {
            const key = oldNode !== null ? oldNode.key : newChild.key;
            resultNode = createFragmentVNode(key, newChild.props.children);
          } else {
            resultNode = updateVNode(oldNode, newChild);
          }
          break;
        }

        if (oldNode === null || !isSameType(oldNode, newChild)) {
          resultNode = createVNodeFromElement(newChild);
          resultNode.ref = newChild.ref;
          resultNode.belongClassVNode = newChild.belongClassVNode;
        } else {
          resultNode = updateVNode(oldNode, newChild.props);
          resultNode.ref = newChild.ref;
          resultNode.belongClassVNode = newChild.belongClassVNode;
        }
        break;
      } else if (newChild.vtype === TYPE_PORTAL) {
        if (oldNode === null || oldNode.tag !== DomPortal || oldNode.realNode !== newChild.realNode) {
          resultNode = createPortalVNode(newChild);
        } else {
          resultNode = updateVNode(oldNode, newChild.children || []);
        }
        break;
      }
    }
  }

  if (resultNode) {
    resultNode.parent = parentNode;
    resultNode.next = null;
  }

  return resultNode;
}

function transRightChildrenToArray(child) {
  const rightChildrenArray: VNode[] = [];

  travelChildren(child, node => {
    rightChildrenArray.push(node);
  });

  return rightChildrenArray;
}

function transLeftChildrenToMap(startChild: VNode, rightEndVNode: VNode | null): Map<string | number, VNode> {
  const leftChildrenMap: Map<string | number, VNode> = new Map();

  travelChildren(
    startChild,
    node => {
      leftChildrenMap.set(node.key !== null ? node.key : node.eIndex, node);
    },
    node => node === rightEndVNode
  );

  return leftChildrenMap;
}

function getOldNodeFromMap(nodeMap: Map<string | number, VNode>, newIdx: number, newChild: any) {
  if (isTextType(newChild)) {
    return nodeMap.get(newIdx) || null;
  }
  if (isObjectType(newChild)) {
    if (Array.isArray(newChild) || isIteratorType(newChild)) {
      return nodeMap.get(newIdx) || null;
    }
    if (newChild.vtype === TYPE_COMMON_ELEMENT || newChild.vtype === TYPE_PORTAL) {
      return nodeMap.get(newChild.key === null ? newIdx : newChild.key) || null;
    }
  }
  return null;
}

/**
 * 左端新老节点对比
 * @param firstNode 第一个VNode
 * @param newChildren 新的JSX children
 * @param parentNode 父节点
 * @param appendNode 添加节点
 */
function diffLeftSide(firstNode: VNode | null, newChildren: Array<any>, parentNode: VNode, appendNode: AppendVNode) {
  let nextOldNode: VNode | null = null;
  // 从左边开始的位置
  let leftIdx = 0;
  // 1. 从左侧开始比对currentVNode和newChildren，若不能复用则跳出循环
  for (; firstNode !== null && leftIdx < newChildren.length; leftIdx++) {
    if (firstNode.eIndex > leftIdx) {
      // 当新旧节点位置不一，则将缓存当前的旧节点，放到下一次对比
      nextOldNode = firstNode;
      firstNode = null;
    } else {
      nextOldNode = firstNode.next;
    }

    // 不能复用，break
    if (!checkCanReuseNode(firstNode, newChildren[leftIdx], leftIdx)) {
      firstNode = firstNode ?? nextOldNode;
      break;
    }

    const newNode = getNewNode(parentNode, newChildren[leftIdx], firstNode);
    // 没有生成新节点，break
    if (!newNode) {
      firstNode = firstNode ?? nextOldNode;
      break;
    }

    // diff过程中，需要将现有的节点清除掉，如果是创建，则不需要处理（因为没有现存节点）
    if (firstNode && newNode.isCreated) {
      deleteVNode(parentNode, firstNode);
    }

    setVNodeAdditionFlag(newNode);
    newNode.eIndex = leftIdx;
    appendNode(newNode);
    firstNode = nextOldNode;
  }

  return { leftEndOldNode: firstNode, leftIdx };
}

/**
 * 右端新老节点对比
 * @param leftEndOldNode 左端对比完成后第一个不同的老节点
 * @param leftIdx 左端diff完成后Index
 * @param newChildren 新的JSX children
 * @param parentNode 父节点
 */
function diffRightSide(
  leftEndOldNode: VNode | null,
  leftIdx: number,
  newChildren: Array<any>,
  parentNode: VNode
): DiffRightSideResult {
  let newNode;
  let canBeReuse = false;
  let rightIdx = newChildren.length;
  let rightEndOldNode; // 老节点中最右边匹配的节点引用 abcde --> abfde 则rightEndOldNode = c;
  let rightNewNode: VNode | null = null; // 最右边匹配的节点引用 abcde --> abfde 则rightNewNode = d;
  // 从后往前，新资源的位置还没有到最末端，旧的vNode也还没遍历完，则可以考虑从后往前开始
  if (rightIdx > leftIdx && leftEndOldNode !== null) {
    const rightRemainingOldChildren = transRightChildrenToArray(leftEndOldNode);
    let rightOldIndex: number | null = rightRemainingOldChildren.length - 1;

    // 2. 从右侧开始比对currentVNode和newChildren，若不能复用则跳出循环
    let rightOldNode;
    for (; rightIdx > leftIdx; rightIdx--) {
      rightOldNode = rightRemainingOldChildren[rightOldIndex];
      if (rightOldIndex < 0 || rightOldNode === null) {
        break;
      }

      canBeReuse = checkCanReuseNode(rightOldNode, newChildren[rightIdx - 1], rightIdx - 1);
      // 不能复用，break
      if (!canBeReuse) {
        break;
      }

      newNode = getNewNode(parentNode, newChildren[rightIdx - 1], rightOldNode);
      // 没有生成新节点，break
      if (newNode === null) {
        break;
      }

      // 链接起来
      if (rightNewNode === null) {
        rightNewNode = newNode;
      } else {
        newNode.next = rightNewNode;
        rightNewNode = newNode;
      }

      if (rightOldNode && newNode.isCreated) {
        deleteVNode(parentNode, rightOldNode);
      }

      setVNodeAdditionFlag(newNode);
      newNode.eIndex = rightIdx - 1;
      rightOldIndex--;
      rightEndOldNode = rightOldNode;
    }
  }

  return { rightIdx, rightEndOldNode, rightNewNode };
}

/**
 * 添加所有右端Diff完成的节点
 * @param leftEndOldNode 左端对比完成后第一个不同的老节点
 * @param parentNode 父节点
 * @param firstChild 第一个VNode
 * @param newChildren 新的JSX children
 * @param diffRightSideResult 右端diff结果
 * @param appendNode 添加节点
 */
function appendRightSideNode(
  leftEndOldNode: VNode | null,
  parentNode: VNode,
  firstChild: VNode | null,
  newChildren: Array<any>,
  diffRightSideResult: DiffRightSideResult,
  appendNode: AppendVNode
) {
  const { rightEndOldNode, rightNewNode } = diffRightSideResult;

  // 清除中间残留的节点
  if (firstChild && parentNode.tag === DomComponent && newChildren.length === 0) {
    FlagUtils.markClear(parentNode);
    parentNode.clearChild = firstChild;
  } else {
    deleteVNodes(parentNode, leftEndOldNode, rightEndOldNode);
  }

  if (rightNewNode) {
    appendNode(rightNewNode);
    setVNodesCIndex(rightNewNode, rightNewNode.cIndex + 1);
  }
}

/**
 * 添加左右端比较完成后剩余新节点和右侧节点
 * @param leftEndOldNode 左端对比完成后第一个不同的老节点
 * @param parentNode 父节点
 * @param newChildren 新的JSX children
 * @param leftIdx 左端diff完成后Index
 * @param diffRightSideResult 右端diff结果
 * @param appendNode 添加节点
 */
function appendAllRestNode(
  leftEndOldNode: VNode | null,
  parentNode: VNode,
  newChildren: Array<any>,
  leftIdx: number,
  diffRightSideResult: DiffRightSideResult,
  appendNode: AppendVNode
) {
  let isDirectAdd = false;
  const { rightIdx, rightNewNode } = diffRightSideResult;

  // 如果dom节点在上次添加前没有节点，说明本次添加时，可以直接添加到最后，不需要通过 getSiblingDom 函数找到 before 节点
  if (
    parentNode.tag === DomComponent &&
    parentNode.oldProps?.children?.length === 0 &&
    rightIdx - leftIdx === newChildren.length
  ) {
    isDirectAdd = true;
  }
  const isAddition = parentNode.tag === DomPortal || !parentNode.isCreated;
  for (; leftIdx < rightIdx; leftIdx++) {
    const newNode = getNewNode(parentNode, newChildren[leftIdx], null);

    if (newNode !== null) {
      if (isAddition) {
        FlagUtils.setAddition(newNode);
      }
      if (isDirectAdd) {
        FlagUtils.markDirectAddition(newNode);
      }
      newNode.eIndex = leftIdx;
      appendNode(newNode);
    }
  }

  if (rightNewNode) {
    appendNode(rightNewNode);
    setVNodesCIndex(rightNewNode.next, rightNewNode.cIndex + 1);
  }
}


/**
 * 双端对比完成，新老节点都有剩余时，构造LIS（最长递增子序列）
 * 属于LIS的新节点直接复用，否则新增
 * @param leftEndOldNode 左端对比完成后第一个不同的老节点
 * @param parentNode 父节点
 * @param newChildren 新的JSX children
 * @param leftIdx 左端diff完成后Index
 * @param diffRightSideResult 右端diff结果
 * @param appendNode 添加节点
 */
function appendNodeWithLIS(
  leftEndOldNode: VNode,
  parentNode: VNode,
  newChildren: Array<any>,
  leftIdx: number,
  diffRightSideResult: DiffRightSideResult,
  appendNode: AppendVNode
) {
  const { rightIdx, rightNewNode, rightEndOldNode } = diffRightSideResult;

  // 把剩下的currentVNode转成Map
  const leftChildrenMap = transLeftChildrenToMap(leftEndOldNode, rightEndOldNode);
  // 通过贪心算法+二分法获取最长递增子序列
  const eIndexes: Array<number> = []; // 记录 eIndex 值
  const subsequence: Array<number> = []; // 记录最长子序列在eIndexes中的 index 值
  const preIndex: Array<number> = []; // 贪心算法在替换的过程中会使得数组不正确，通过记录preIndex找到正确值
  const reuseNodes: (VNode | null)[] = []; // 记录复用的 VNode
  let i = 0;
  let oldNodeFromMap;
  let last;
  for (; leftIdx < rightIdx; leftIdx++) {
    oldNodeFromMap = getOldNodeFromMap(leftChildrenMap, leftIdx, newChildren[leftIdx]);
    const newNode = getNewNode(parentNode, newChildren[leftIdx], oldNodeFromMap);
    if (newNode !== null) {
      if (newNode.isCreated) {
        // 新VNode，直接打上标签新增，不参与到复用，旧的VNode会在后面打上delete标签
        FlagUtils.setAddition(newNode);
      } else {
        // 从Map删除，后面不会deleteVNode，就可以实现复用
        leftChildrenMap.delete(newNode.key || leftIdx);
        if (oldNodeFromMap !== null) {
          const eIndex = newNode.eIndex;
          eIndexes.push(eIndex);
          last = eIndexes[subsequence[subsequence.length - 1]];
          if (eIndex > last || last === undefined) {
            // 大的 eIndex直接放在最后
            preIndex[i] = subsequence[subsequence.length - 1];
            subsequence.push(i);
          } else {
            let start = 0;
            let end = subsequence.length - 1;
            let middle;
            // 二分法找到需要替换的值
            while (start < end) {
              middle = Math.floor((start + end) / 2);
              if (eIndexes[subsequence[middle]] > eIndex) {
                end = middle;
              } else {
                start = middle + 1;
              }
            }
            if (eIndex < eIndexes[subsequence[start]]) {
              preIndex[i] = subsequence[start - 1];
              subsequence[start] = i;
            }
          }
          i++;
          reuseNodes.push(newNode); // 记录所有复用的节点
        }
      }
      newNode.eIndex = leftIdx;
      appendNode(newNode);
    }
  }

  // 向前回溯找到正确的结果
  let length = subsequence.length;
  let prev = subsequence[length - 1];
  while (length-- > 0) {
    subsequence[length] = prev;
    prev = preIndex[subsequence[length]];
  }
  subsequence.forEach(idx => {
    // 把需要复用的节点从 restNodes 中清理掉，因为不需要打 add 标记，直接复用 dom 节点
    reuseNodes[idx] = null;
  });
  reuseNodes.forEach(node => {
    if (node !== null) {
      // 没有被清理的节点打上 add 标记，通过dom的append操作实现位置移动
      FlagUtils.setAddition(node);
    }
  });
  leftChildrenMap.forEach(child => {
    deleteVNode(parentNode, child);
  });

  if (rightNewNode) {
    appendNode(rightNewNode);
    setVNodesCIndex(rightNewNode.next, rightNewNode.cIndex + 1);
  }
}

// diff数组类型的节点，核心算法
function diffArrayNodesHandler(parentNode: VNode, firstChild: VNode | null, newChildren: Array<any>): VNode | null {
  let resultingFirstChild: VNode | null = null;
  let prevNewNode: VNode | null = null;

  function appendNode(newNode: VNode) {
    if (prevNewNode === null) {
      resultingFirstChild = newNode;
      newNode.cIndex = 0;
    } else {
      prevNewNode.next = newNode;
      newNode.cIndex = prevNewNode.cIndex + 1;
    }
    markVNodePath(newNode);
    prevNewNode = newNode;
  }

  // 1. 左端新老节点对比
  const { leftEndOldNode, leftIdx } = diffLeftSide(firstChild, newChildren, parentNode, appendNode);

  // 2. 右端新老节点对比
  const diffRightSideResult = diffRightSide(leftEndOldNode, leftIdx, newChildren, parentNode);

  // 3. 新节点已经处理完成
  if (leftIdx === diffRightSideResult.rightIdx) {
    appendRightSideNode(leftEndOldNode, parentNode, firstChild, newChildren, diffRightSideResult, appendNode);
    return resultingFirstChild;
  }

  // 4. 新节点还有一部分，但是老节点已经没有了
  if (leftEndOldNode === null) {
    appendAllRestNode(leftEndOldNode, parentNode, newChildren, leftIdx, diffRightSideResult, appendNode);
    return resultingFirstChild;
  }

  // 5. 新节点还有一部分，但是老节点也还有一部分
  appendNodeWithLIS(leftEndOldNode, parentNode, newChildren, leftIdx, diffRightSideResult, appendNode);
  return resultingFirstChild;
}

// 设置vNode中的cIndex属性，cIndex是节点在children中的位置
function setVNodesCIndex(startChild: VNode | null, startIdx: number) {
  let node: VNode | null = startChild;
  let idx = startIdx;

  while (node !== null) {
    node.cIndex = idx;
    markVNodePath(node);
    node = node.next;
    idx++;
  }
}

// 新节点是迭代器类型
function diffIteratorNodesHandler(
  parentNode: VNode,
  firstChild: VNode | null,
  newChildrenIterable: Iterable<any>
): VNode | null {
  const iteratorFn = getIteratorFn(newChildrenIterable);
  const iteratorObj: Iterator<any> = iteratorFn.call(newChildrenIterable);

  // 把iterator转测数组
  const childrenArray: any[] = [];
  let result = iteratorObj.next();
  while (!result.done) {
    childrenArray.push(result.value);
    result = iteratorObj.next();
  }

  return diffArrayNodesHandler(parentNode, firstChild, childrenArray);
}

// 新节点是字符串类型
function diffStringNodeHandler(parentNode: VNode, newChild: any, firstChildVNode: VNode | null, isComparing: boolean) {
  let newTextNode: VNode | null = null;

  // 第一个vNode是Text，则复用
  if (firstChildVNode !== null && firstChildVNode.tag === DomText) {
    newTextNode = updateVNode(firstChildVNode, String(newChild));
    deleteVNodes(parentNode, firstChildVNode.next);
    newTextNode.next = null;
  } else {
    newTextNode = createDomTextVNode(String(newChild));
    deleteVNodes(parentNode, firstChildVNode);
  }

  if (isComparing && newTextNode.isCreated) {
    FlagUtils.setAddition(newTextNode);
  }
  newTextNode.parent = parentNode;
  newTextNode.cIndex = 0;
  markVNodePath(newTextNode);

  return newTextNode;
}

// 新节点是对象类型
function diffObjectNodeHandler(parentNode: VNode, firstChild: VNode | null, newChild: any, isComparing: boolean) {
  let canReuseNode: VNode | null = null;

  // 通过key比对是否有可以reuse
  const newKey = newChild.key;
  let node = firstChild;
  while (node !== null) {
    if (node.key === newKey) {
      canReuseNode = node;
      break;
    } else {
      deleteVNode(parentNode, node);
      node = node.next;
    }
  }

  let resultNode: VNode | null = null;
  let startDelVNode: VNode | null = firstChild;
  if (newChild.vtype === TYPE_COMMON_ELEMENT) {
    if (canReuseNode) {
      // 可以复用
      if (canReuseNode.tag === Fragment && newChild.type === TYPE_FRAGMENT) {
        resultNode = updateVNode(canReuseNode, newChild.props.children);
        startDelVNode = canReuseNode.next;
        resultNode.next = null;
      } else if (isSameType(canReuseNode, newChild)) {
        resultNode = updateVNode(canReuseNode, newChild.props);
        resultNode.ref = newChild.ref;
        resultNode.belongClassVNode = newChild.belongClassVNode;
        startDelVNode = resultNode.next;
        resultNode.next = null;
      }
    }

    if (resultNode === null) {
      // 新建
      if (newChild.type === TYPE_FRAGMENT) {
        resultNode = createFragmentVNode(newChild.key, newChild.props.children);
      } else {
        resultNode = createVNodeFromElement(newChild);
        resultNode.ref = newChild.ref;
        resultNode.belongClassVNode = newChild.belongClassVNode;
      }
    }
  } else if (newChild.vtype === TYPE_PORTAL) {
    if (canReuseNode) {
      // 可以复用
      if (canReuseNode.tag === DomPortal && canReuseNode.realNode === newChild.realNode) {
        resultNode = updateVNode(canReuseNode, newChild.children || []);
        startDelVNode = canReuseNode.next;
        resultNode.next = null;
      }
    }
    if (resultNode === null) {
      // 新建
      resultNode = createPortalVNode(newChild);
    }
  }

  if (resultNode) {
    if (isComparing && resultNode.isCreated) {
      FlagUtils.setAddition(resultNode);
    }

    resultNode.parent = parentNode;
    resultNode.cIndex = 0;
    markVNodePath(resultNode);

    if (startDelVNode) {
      deleteVNodes(parentNode, startDelVNode);
    }
    return resultNode;
  }

  return null;
}

// Diff算法的对外接口
export function createChildrenByDiff(
  parentNode: VNode,
  firstChild: VNode | null,
  newChild: any,
  isComparing: boolean
): VNode | null {
  const isFragment = isNoKeyFragment(newChild);
  newChild = isFragment ? newChild.props.children : newChild;

  // 1. 没有新节点，直接把vNode标记为删除
  if (newChild == null) {
    if (isComparing) {
      deleteVNodes(parentNode, firstChild);
    }
    return null;
  }

  // 2. newChild是字串类型
  if (isTextType(newChild)) {
    return diffStringNodeHandler(parentNode, newChild, firstChild, isComparing);
  }

  // 3. newChild是数组类型
  if (Array.isArray(newChild)) {
    return diffArrayNodesHandler(parentNode, firstChild, newChild);
  }

  // 4. newChild是迭代器类型
  if (isIteratorType(newChild)) {
    return diffIteratorNodesHandler(parentNode, firstChild, newChild);
  }

  // 5. newChild是对象类型
  if (isObjectType(newChild)) {
    const newVNodes = diffObjectNodeHandler(parentNode, firstChild, newChild, isComparing);
    if (newVNodes) {
      return newVNodes;
    }
  }

  // 6. 其它情况删除所有节点
  if (firstChild) {
    deleteVNodes(parentNode, firstChild);
  }

  return null;
}
