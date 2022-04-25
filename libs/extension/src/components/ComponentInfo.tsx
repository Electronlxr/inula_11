import styles from './ComponentsInfo.less';
import Eye from '../svgs/Eye';
import Debug from '../svgs/Debug';
import Copy from '../svgs/Copy';
import Triangle from '../svgs/Triangle';
import { useState, useEffect } from 'horizon';
import { IData } from './VTree';
import { buildAttrModifyData, IAttr } from '../parser/parseAttr';
import { postMessageToBackground } from '../panelConnection';
import { ModifyAttrs } from '../utils/constants';

type IComponentInfo = {
  name: string;
  attrs: {
    parsedProps?: IAttr[],
    parsedState?: IAttr[],
    parsedHooks?: IAttr[],
  };
  parents: IData[];
  id: number;
  onClickParent: (item: IData) => void;
};

function collapseAllNodes(attrs: IAttr[]) {
  return attrs.filter((item, index) => {
    const nextItem = attrs[index + 1];
    return nextItem ? nextItem.indentation - item.indentation > 0 : false;
  });
}

function ComponentAttr({ attrsName, attrsType, attrs, id }: {
  attrsName: string,
  attrsType: string,
  attrs: IAttr[],
  id: number}) {
  const [collapsedNode, setCollapsedNode] = useState(collapseAllNodes(attrs));
  const [editableAttrs, setEditableAttrs] = useState(attrs);
  useEffect(() => {
    setCollapsedNode(collapseAllNodes(attrs));
    setEditableAttrs(attrs);
  }, [attrs]);

  const handleCollapse = (item: IAttr) => {
    const nodes = [...collapsedNode];
    const i = nodes.indexOf(item);
    if (i === -1) {
      nodes.push(item);
    } else {
      nodes.splice(i, 1);
    }
    setCollapsedNode(nodes);
  };

  const showAttr = [];
  let currentIndentation = null;
  editableAttrs.forEach((item, index) => {
    const indentation = item.indentation;
    if (currentIndentation !== null) {
      if (indentation > currentIndentation) {
        return;
      } else {
        currentIndentation = null;
      }
    }
    const nextItem = editableAttrs[index + 1];
    const hasChild = nextItem ? nextItem.indentation - item.indentation > 0 : false;
    const isCollapsed = collapsedNode.includes(item);
    showAttr.push(
      <div style={{ paddingLeft: item.indentation * 10 }} key={index} onClick={() => handleCollapse(item)}>
        <span className={styles.attrArrow}>{hasChild && <Triangle director={isCollapsed ? 'right' : 'down'} />}</span>
        <span className={styles.attrName}>{`${item.name}`}</span>
        {' :'}
        {item.type === 'string' || item.type === 'number' ? (
          <input
            value={item.value}
            className={styles.attrValue}
            onChange={(event) => {
              const nextAttrs = [...editableAttrs];
              const nextItem = {...item};
              nextItem.value = event.target.value;
              nextAttrs[index] = nextItem;
              setEditableAttrs(nextAttrs);
            }}
            onKeyUp={(event) => {
              const value = (event.target as HTMLInputElement).value;
              if (event.key === 'Enter') {
                if(isDev) {
                  console.log('post attr change', value);
                } else {
                  const data = buildAttrModifyData(attrsType,attrs, value,item, index, id);
                  postMessageToBackground(ModifyAttrs, data);
                }
              }
            }}
          />
        ) : (
          <span className={styles.attrValue}>{item.value}</span>
        )}
      </div>
    );
    if (isCollapsed) {
      currentIndentation = indentation;
    }
  });

  return (
    <div className={styles.attrContainer}>
      <div className={styles.attrHead}>
        <span className={styles.attrType}>{attrsName}</span>
        <span className={styles.attrCopy}>
          <Copy />
        </span>
      </div>
      <div className={styles.attrDetail}>
        {showAttr}
      </div>
    </div>
  );
}

export default function ComponentInfo({ name, attrs, parents, id, onClickParent }: IComponentInfo) {
  return (
    <div className={styles.infoContainer} >
      <div className={styles.componentInfoHead}>
        {name && <>
          <span className={styles.name}>
            {name}
          </span>
          <span className={styles.eye} >
            <Eye />
          </span>
          <span className={styles.debug}>
            <Debug />
          </span>
        </>}
      </div>
      <div className={styles.componentInfoMain}>
        {Object.keys(attrs).map(attrsType => {
          const parsedAttrs = attrs[attrsType];
          if (parsedAttrs && parsedAttrs.length !== 0) {
            const attrsName = attrsType.slice(6); // parsedState => State
            return <ComponentAttr attrsName={attrsName} attrs={parsedAttrs} id={id} attrsType={attrsType}/>;
          }
          return null;
        })}
        <div className={styles.parentsInfo}>
          {name && <div>
            parents: {
              parents.map(item => (<button
              className={styles.parent}
                onClick={() => (onClickParent(item))}>
                {item.name}
              </button>))
            }
          </div>}
        </div>
      </div>
    </div>
  );
}
