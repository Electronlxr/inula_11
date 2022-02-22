import {
  allDelegatedHorizonEvents,
} from '../../event/EventCollection';
import { updateCommonProp } from './UpdateCommonProp';
import { setStyles } from './StyleHandler';
import {
  listenNonDelegatedEvent
} from '../../event/EventBinding';
import { isEventProp, isNativeElement } from '../validators/ValidateProps';

// 初始化DOM属性
export function setDomProps(
  tagName: string,
  dom: Element,
  props: Object,
): void {
  const isNativeTag = isNativeElement(tagName, props);
  const keysOfProps = Object.keys(props);
  let propName;
  let propVal;
  const keyLength = keysOfProps.length;
  for (let i = 0; i < keyLength; i++) {
    propName = keysOfProps[i];
    propVal = props[propName];

    if (propName === 'style') {
      setStyles(dom, propVal);
    } else if (isEventProp(propName)) {
      // 事件监听属性处理
      if (!allDelegatedHorizonEvents.has(propName)) {
        listenNonDelegatedEvent(propName, dom, propVal);
      }
    } else if (propName === 'children') { // 只处理纯文本子节点，其他children在VNode树中处理
      const type = typeof propVal;
      if (type === 'string' || type === 'number') {
        dom.textContent = propVal;
      }
    } else if (propName === 'dangerouslySetInnerHTML') {
      dom.innerHTML = propVal.__html;
    } else {
      if (propVal != null) {
        updateCommonProp(dom, propName, propVal, isNativeTag);
      }
    }
  }
}

// 更新 DOM 属性
export function updateDomProps(
  dom: Element,
  changeList: Map<string, any>,
  isNativeTag: boolean,
): void {
  for(const [propName, propVal] of changeList) {
    if (propName === 'style') {
      setStyles(dom, propVal);
    } else if (isEventProp(propName)) {
      // 事件监听属性处理
      if (!allDelegatedHorizonEvents.has(propName)) {
        listenNonDelegatedEvent(propName, dom, propVal);
      }
    } else if (propName === 'children') { // 只处理纯文本子节点，其他children在VNode树中处理
      const type = typeof propVal;
      if (type === 'string' || type === 'number') {
        dom.textContent = propVal;
      }
    } else if (propName === 'dangerouslySetInnerHTML') {
      dom.innerHTML = propVal.__html;
    } else {
      updateCommonProp(dom, propName, propVal, isNativeTag);
    }
  }
}

// 找出两个 DOM 属性的差别，生成需要更新的属性集合
export function compareProps(
  oldProps: Object,
  newProps: Object,
): Map<string, any> {
  let updatesForStyle = {};
  const toUpdateProps = new Map();
  const keysOfOldProps = Object.keys(oldProps);
  const keysOfNewProps = Object.keys(newProps);

  const oldPropsLength = keysOfOldProps.length;
  let propName;
  let oldStyle;
  let styleProps;
  let styleProp;
  // 找到旧属性中需要删除的属性
  for (let i = 0; i < oldPropsLength; i++) {
    propName = keysOfOldProps[i];
    // 新属性中包含该属性或者该属性为空值的属性不需要处理
    if (keysOfNewProps.includes(propName) || oldProps[propName] == null) {
      continue;
    }

    if (propName === 'style') {
      oldStyle = oldProps[propName];
      styleProps = Object.keys(oldStyle);
      for (let j = 0; j < styleProps.length; j++) {
        styleProp = styleProps[j];
        updatesForStyle[styleProp] = '';
      }
    } else if (
      propName === 'autoFocus' ||
      propName === 'children' ||
      propName === 'dangerouslySetInnerHTML'
    ) {
      continue;
    } else if (isEventProp(propName)) {
      if (!allDelegatedHorizonEvents.has(propName)) {
        toUpdateProps.set(propName, null);
      }
    } else {
      // 其它属性都要加入到删除队列里面，等待删除
      toUpdateProps.set(propName, null);
    }
  }

  let newPropValue;
  let oldPropValue;
  let oldStyleProps;
  let newStyleProps;
  let newHTML;
  let oldHTML;
  // 遍历新属性，获取新增和变更属性
  for (let i = 0; i < keysOfNewProps.length; i++) {
    propName = keysOfNewProps[i];
    newPropValue = newProps[propName];
    oldPropValue = oldProps != null ? oldProps[propName] : null;

    if (newPropValue === oldPropValue || (newPropValue == null && oldPropValue == null)) {
      // 新旧属性值未发生变化，或者新旧属性皆为空值，不需要进行处理
      continue;
    }

    if (propName === 'style') {
      if (oldPropValue) { // 之前 style 属性有设置非空值
        // 原来有这个 style，但现在没这个 style 了
        oldStyleProps = Object.keys(oldPropValue);
        for (let j = 0; j < oldStyleProps.length; j++) {
          styleProp = oldStyleProps[j];
          if (!newPropValue || !Object.prototype.hasOwnProperty.call(newPropValue, styleProp)) {
            updatesForStyle[styleProp] = '';
          }
        }

        // 现在有这个 style，但是和原来不相等
        newStyleProps = newPropValue ? Object.keys(newPropValue) : [];
        for (let j = 0; j < newStyleProps.length; j++) {
          styleProp = newStyleProps[j];
          if (oldPropValue[styleProp] !== newPropValue[styleProp]) {
            updatesForStyle[styleProp] = newPropValue[styleProp];
          }
        }
      } else { // 之前未设置 style 属性或者设置了空值
        if (Object.keys(updatesForStyle).length === 0) {
          toUpdateProps.set(propName, null);
        }
        updatesForStyle = newPropValue;
      }
    } else if (propName === 'dangerouslySetInnerHTML') {
      newHTML = newPropValue ? newPropValue.__html : undefined;
      oldHTML = oldPropValue ? oldPropValue.__html : undefined;
      if (newHTML != null) {
        if (oldHTML !== newHTML) {
          toUpdateProps.set(propName, newPropValue);
        }
      }
    } else if (propName === 'children') {
      if (typeof newPropValue === 'string' || typeof newPropValue === 'number') {
        toUpdateProps.set(propName, String(newPropValue));
      }
    } else if (isEventProp(propName)) {
      if (!allDelegatedHorizonEvents.has(propName)) {
        toUpdateProps.set(propName, newPropValue);
      }
    } else {
      toUpdateProps.set(propName, newPropValue);
    }
  }

  // 处理style
  if (Object.keys(updatesForStyle).length > 0) {
    toUpdateProps.set('style', updatesForStyle);
  }

  return toUpdateProps;
}
