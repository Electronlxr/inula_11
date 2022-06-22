import { AnyNativeEvent, ListenerUnitList } from './Types';
import type { VNode } from '../renderer/Types';
import { isInputElement, setPropertyWritable } from './utils';
import { decorateNativeEvent } from './EventWrapper';
import { getListenersFromTree } from './ListenerGetter';
import { asyncUpdates, runDiscreteUpdates } from '../renderer/Renderer';
import { findRoot } from '../renderer/vnode/VNodeUtils';
import { syncRadiosHandler } from '../dom/valueHandler/InputValueHandler';
import {
  EVENT_TYPE_ALL,
  EVENT_TYPE_BUBBLE,
  EVENT_TYPE_CAPTURE,
  horizonEventToNativeMap,
  transformToHorizonEvent,
} from './EventHub';
import { getDomTag } from '../dom/utils/Common';
import { updateInputValueIfChanged } from '../dom/valueHandler/ValueChangeHandler';
import { getDom } from '../dom/DOMInternalKeys';

// web规范，鼠标右键key值
const RIGHT_MOUSE_BUTTON = 2;

// 返回是否需要触发change事件标记
// | 元素 | 事件 |  需要值变更 |
// | --- | ---  | ---------------  |
// | <select/> / <input type="file/> | change | NO |
// | <input type="checkbox" /> <input type="radio" /> | click | YES |
// | <input type="input /> / <input type="text" /> | input / change | YES |
function shouldTriggerChangeEvent(targetDom, evtName) {
  const { type } = targetDom;
  const domTag = getDomTag(targetDom);

  if (domTag === 'select' || (domTag === 'input' && type === 'file')) {
    return evtName === 'change';
  } else if (domTag === 'input' && (type === 'checkbox' || type === 'radio')) {
    if (evtName === 'click') {
      return updateInputValueIfChanged(targetDom);
    }
  } else if (isInputElement(targetDom)) {
    if (evtName === 'input' || evtName === 'change') {
      return updateInputValueIfChanged(targetDom);
    }
  }
  return false;
}

/**
 *
 * 支持input/textarea/select的onChange事件
 */
function getChangeListeners(
  nativeEvtName: string,
  nativeEvt: AnyNativeEvent,
  vNode: null | VNode,
): ListenerUnitList {
  if (!vNode) {
    return [];
  }
  const targetDom = getDom(vNode);

  // 判断是否需要触发change事件
  if (shouldTriggerChangeEvent(targetDom, nativeEvtName)) {
    const event = decorateNativeEvent(
      'onChange',
      'change',
      nativeEvt,
    );
    return getListenersFromTree(vNode, 'onChange', event, EVENT_TYPE_ALL);
  }

  return [];
}

// 获取事件触发的普通事件监听方法队列
function getCommonListeners(
  nativeEvtName: string,
  vNode: null | VNode,
  nativeEvent: AnyNativeEvent,
  target: null | EventTarget,
  isCapture: boolean,
): ListenerUnitList {
  const horizonEvtName = transformToHorizonEvent(nativeEvtName);

  if (!horizonEvtName) {
    return [];
  }

  // 鼠标点击右键
  if (nativeEvent instanceof MouseEvent && nativeEvtName === 'click' && nativeEvent.button === RIGHT_MOUSE_BUTTON) {
    return [];
  }

  if (nativeEvtName === 'focusin') {
    nativeEvtName = 'focus';
  }

  if (nativeEvtName === 'focusout') {
    nativeEvtName = 'blur';
  }

  const horizonEvent = decorateNativeEvent(horizonEvtName, nativeEvtName, nativeEvent);
  return getListenersFromTree(
    vNode,
    horizonEvtName,
    horizonEvent,
    isCapture ? EVENT_TYPE_CAPTURE : EVENT_TYPE_BUBBLE,
  );
}

// 按顺序执行事件队列
function processListeners(listenerList: ListenerUnitList): void {
  listenerList.forEach(eventUnit => {
    const { currentTarget, listener, event } = eventUnit;
    if (event.isPropagationStopped()) {
      return;
    }

    setPropertyWritable(event, 'currentTarget');
    event.currentTarget = currentTarget;
    listener(event);
    event.currentTarget = null;
  });
}

function getProcessListeners(
  nativeEvtName: string,
  vNode: VNode | null,
  nativeEvent: AnyNativeEvent,
  target,
  isCapture: boolean,
): ListenerUnitList {
  // 触发普通委托事件
  let listenerList: ListenerUnitList = getCommonListeners(
    nativeEvtName,
    vNode,
    nativeEvent,
    target,
    isCapture,
  );

  // 触发特殊handler委托事件
  if (!isCapture) {
    if (horizonEventToNativeMap.get('onChange')!.includes(nativeEvtName)) {
      listenerList = listenerList.concat(getChangeListeners(
        nativeEvtName,
        nativeEvent,
        vNode,
      ));
    }
  }
  return listenerList;
}

// 触发可以被执行的horizon事件监听
function triggerHorizonEvents(
  nativeEvtName: string,
  isCapture: boolean,
  nativeEvent: AnyNativeEvent,
  vNode: VNode | null,
) {
  const nativeEventTarget = nativeEvent.target || nativeEvent.srcElement;

  // 获取委托事件队列
  const listenerList = getProcessListeners(nativeEvtName, vNode, nativeEvent, nativeEventTarget, isCapture);

  // 处理触发的事件队列
  processListeners(listenerList);

  return listenerList;
}


// 其他事件正在执行中标记
let isInEventsExecution = false;

// 处理委托事件入口
export function handleEventMain(
  nativeEvtName: string,
  isCapture: boolean,
  nativeEvent: AnyNativeEvent,
  vNode: null | VNode,
  targetDom: EventTarget,
): void {
  let startVNode = vNode;
  if (startVNode !== null) {
    startVNode = findRoot(startVNode, targetDom);
    if (!startVNode) {
      return;
    }
  }

  // 有事件正在执行，同步执行事件
  if (isInEventsExecution) {
    triggerHorizonEvents(nativeEvtName, isCapture, nativeEvent, startVNode);
    return;
  }

  // 没有事件在执行，经过调度再执行事件
  isInEventsExecution = true;
  let shouldDispatchUpdate = false;
  try {
    const listeners = asyncUpdates(() => triggerHorizonEvents(nativeEvtName, isCapture, nativeEvent, startVNode));
    if (listeners.length) {
      shouldDispatchUpdate = true;
    }
  } finally {
    isInEventsExecution = false;
    if (shouldDispatchUpdate) {
      runDiscreteUpdates();
      // 若是Radio，同步同组其他Radio的Handler Value
      syncRadiosHandler(nativeEvent.target as Element);
    }
  }
}
