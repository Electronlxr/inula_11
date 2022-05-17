import * as Horizon from '@cloudsop/horizon/index.ts';
import { getLogUtils } from '../jest/testUtils';

describe('PortalComponent Test', () => {
  const LogUtils = getLogUtils();
  
  it('将子节点渲染到存在于父组件以外的 DOM 节点', () => {
    const portalRoot = document.createElement('div');

    class PortalApp extends Horizon.Component {
      constructor(props) {
        super(props);
        this.element = portalRoot;
      }

      render() {
        return Horizon.createPortal(
          this.props.child,
          this.element,
        );
      }
    }
    Horizon.render(<PortalApp child={<div>PortalApp</div>} />, container);
    expect(container.textContent).toBe('');
    // <div>PortalApp</div>被渲染到了portalRoot而非container
    expect(portalRoot.textContent).toBe('PortalApp');

    Horizon.unmountComponentAtNode(container);
    expect(container.textContent).toBe('');
    expect(portalRoot.textContent).toBe('');
  });

  it('渲染多个Portal', () => {
    const portalRoot1st = document.createElement('div');
    const portalRoot2nd = document.createElement('div');

    class PortalApp extends Horizon.Component {
      constructor(props) {
        super(props);
        this.element = portalRoot1st;
        this.newElement = portalRoot2nd;
      }

      render() {
        return [
          Horizon.createPortal(
            this.props.child,
            this.element,
          ),
          Horizon.createPortal(
            this.props.child,
            this.newElement,
          )
        ];
      }
    }
    Horizon.render(<PortalApp child={<div>PortalApp</div>} />, container);
    expect(container.textContent).toBe('');
    // <div>PortalApp</div>被渲染到了portalRoot而非container
    expect(portalRoot1st.textContent).toBe('PortalApp');
    expect(portalRoot2nd.textContent).toBe('PortalApp');

    Horizon.unmountComponentAtNode(container);
    expect(container.textContent).toBe('');
    expect(portalRoot1st.textContent).toBe('');
    expect(portalRoot2nd.textContent).toBe('');
  });

  it('渲染最近的Portal', () => {
    const portalRoot1st = document.createElement('div');
    const portalRoot2nd = document.createElement('div');
    const portalRoot3rd = document.createElement('div');

    class PortalApp extends Horizon.Component {
      constructor(props) {
        super(props);
        this.element = portalRoot1st;
        this.newElement = portalRoot2nd;
        this.element3rd = portalRoot3rd;
      }

      render() {
        return [
          <div>PortalApp1st</div>,
          Horizon.createPortal([
            <div>PortalApp4</div>,
            Horizon.createPortal(
              this.props.child,
              this.element3rd,
            ),
          ], this.element),
          <div>PortalApp2nd</div>,
          Horizon.createPortal(
            this.props.child,
            this.newElement,
          )
        ];
      }
    }
    Horizon.render(<PortalApp child={<div>PortalApp</div>} />, container);
    expect(container.textContent).toBe('PortalApp1stPortalApp2nd');
    // <div>PortalApp4</div>会挂载在this.element上
    expect(portalRoot1st.textContent).toBe('PortalApp4');
    expect(portalRoot2nd.textContent).toBe('PortalApp');
    expect(portalRoot3rd.textContent).toBe('PortalApp');

    Horizon.unmountComponentAtNode(container);
    expect(container.textContent).toBe('');
    expect(portalRoot1st.textContent).toBe('');
    expect(portalRoot2nd.textContent).toBe('');
  });

  it('改变Portal的参数', () => {
    const portalRoot = document.createElement('div');

    class PortalApp extends Horizon.Component {
      constructor(props) {
        super(props);
        this.element = portalRoot;
      }

      render() {
        return Horizon.createPortal(
          this.props.child,
          this.element,
        );
      }
    }
    Horizon.render(<PortalApp key='portal' child={<div>PortalApp</div>} />, container);
    expect(container.textContent).toBe('');
    expect(portalRoot.textContent).toBe('PortalApp');

    Horizon.render(<PortalApp key='portal' child={<div>AppPortal</div>} />, container);
    expect(container.textContent).toBe('');
    expect(portalRoot.textContent).toBe('AppPortal');

    Horizon.render(<PortalApp key='portal' child={['por', 'tal']} />, container);
    expect(container.textContent).toBe('');
    expect(portalRoot.textContent).toBe('portal');

    Horizon.render(<PortalApp key='portal' child={null} />, container);
    expect(container.textContent).toBe('');
    expect(portalRoot.textContent).toBe('');

    Horizon.unmountComponentAtNode(container);
    expect(container.textContent).toBe('');
    expect(portalRoot.textContent).toBe('');
  });

  it('通过Portal进行事件冒泡', () => {
    const portalRoot = document.createElement('div');
    const buttonRef = Horizon.createRef();

    class PortalApp extends Horizon.Component {
      constructor(props) {
        super(props);
        this.element = portalRoot;
      }

      render() {
        return Horizon.createPortal(
          this.props.child,
          this.element,
        );
      }
    }

    const Child = () => {
      return (
        <div>
          <button ref={buttonRef}>Click</button>
        </div>
      );
    };


    const App = () => {
      const handleClick = () => {
        LogUtils.log('bubble click event');
      };

      const handleCaptureClick = () => {
        LogUtils.log('capture click event');
      };

      return (
        <div onClickCapture={handleCaptureClick()} onClick={handleClick()}>
          <PortalApp child={<Child />}>

          </PortalApp>
        </div>
      );
    };
    Horizon.render(<App />, container);
    const event = document.createEvent('Event');
    event.initEvent('click', true, true);
    buttonRef.current.dispatchEvent(event);

    expect(LogUtils.getAndClear()).toEqual([
      // 从外到内先捕获再冒泡
      'capture click event',
      'bubble click event'
    ]);
  });
});