import * as Horizon from '@cloudsop/horizon/index.ts';
import { clearStore, createStore, useStore } from '../../../../libs/horizon/src/horizonx/store/StoreHandler';
import { App, Text, triggerClickEvent } from '../../jest/commonComponents';

describe('在Class组件中，测试store中的Array', () => {
  const { unmountComponentAtNode } = Horizon;
  let container = null;
  beforeEach(() => {
    // 创建一个 DOM 元素作为渲染目标
    container = document.createElement('div');
    document.body.appendChild(container);

    const persons = [
      { name: 'p1', age: 1 },
      { name: 'p2', age: 2 },
    ];

    createStore({
      id: 'user',
      state: {
        type: 'bing dun dun',
        persons: persons,
      },
      actions: {
        addOnePerson: (state, person) => {
          state.persons.push(person);
        },
        delOnePerson: state => {
          state.persons.pop();
        },
        clearPersons: state => {
          state.persons = null;
        },
      },
    });
  });

  afterEach(() => {
    // 退出时进行清理
    unmountComponentAtNode(container);
    container.remove();
    container = null;

    clearStore('user');
  });

  const newPerson = { name: 'p3', age: 3 };

  class Parent extends Horizon.Component {
    userStore = useStore('user');

    addOnePerson = () => {
      this.userStore.addOnePerson(newPerson);
    };

    delOnePerson = () => {
      this.userStore.delOnePerson();
    };

    render() {
      return (
        <div>
          <button id={'addBtn'} onClick={this.addOnePerson}>
            add person
          </button>
          <button id={'delBtn'} onClick={this.delOnePerson}>
            delete person
          </button>
          <div>{this.props.children}</div>
        </div>
      );
    }
  }

  it('测试Array方法: push()、pop()', () => {
    class Child extends Horizon.Component {
      userStore = useStore('user');

      render() {
        return (
          <div>
            <Text id={'hasPerson'} text={`has new person: ${this.userStore.persons.length}`} />
          </div>
        );
      }
    }

    Horizon.render(<App parent={Parent} child={Child} />, container);

    expect(container.querySelector('#hasPerson').innerHTML).toBe('has new person: 2');
    // 在Array中增加一个对象
    Horizon.act(() => {
      triggerClickEvent(container, 'addBtn');
    });
    expect(container.querySelector('#hasPerson').innerHTML).toBe('has new person: 3');

    // 在Array中删除一个对象
    Horizon.act(() => {
      triggerClickEvent(container, 'delBtn');
    });
    expect(container.querySelector('#hasPerson').innerHTML).toBe('has new person: 2');
  });

  it('测试Array方法: entries()、push()、shift()、unshift、直接赋值', () => {
    let globalStore = null;

    class Child extends Horizon.Component {
      userStore = useStore('user');

      constructor(props) {
        super(props);
        globalStore = this.userStore;
      }

      render() {
        const nameList = [];
        const entries = this.userStore.$state.persons?.entries();
        if (entries) {
          for (const entry of entries) {
            nameList.push(entry[1].name);
          }
        }

        return (
          <div>
            <Text id={'nameList'} text={`name list: ${nameList.join(' ')}`} />
          </div>
        );
      }
    }

    Horizon.render(<App parent={Parent} child={Child} />, container);

    expect(container.querySelector('#nameList').innerHTML).toBe('name list: p1 p2');
    // push
    globalStore.$state.persons.push(newPerson);
    expect(container.querySelector('#nameList').innerHTML).toBe('name list: p1 p2 p3');

    // shift
    globalStore.$state.persons.shift({ name: 'p0', age: 0 });
    expect(container.querySelector('#nameList').innerHTML).toBe('name list: p2 p3');

    // 赋值[2]
    globalStore.$state.persons[2] = { name: 'p4', age: 4 };
    expect(container.querySelector('#nameList').innerHTML).toBe('name list: p2 p3 p4');

    // 重新赋值[2]
    globalStore.$state.persons[2] = { name: 'p5', age: 5 };
    expect(container.querySelector('#nameList').innerHTML).toBe('name list: p2 p3 p5');

    // unshift
    globalStore.$state.persons.unshift({ name: 'p1', age: 1 });
    expect(container.querySelector('#nameList').innerHTML).toBe('name list: p1 p2 p3 p5');

    // 重新赋值 null
    globalStore.$state.persons = null;
    expect(container.querySelector('#nameList').innerHTML).toBe('name list: ');

    // 重新赋值 [{ name: 'p1', age: 1 }]
    globalStore.$state.persons = [{ name: 'p1', age: 1 }];
    expect(container.querySelector('#nameList').innerHTML).toBe('name list: p1');
  });

  it('测试Array方法: forEach()', () => {
    let globalStore = null;

    class Child extends Horizon.Component {
      userStore = useStore('user');

      constructor(props) {
        super(props);
        globalStore = this.userStore;
      }

      render() {
        const nameList = [];
        this.userStore.$state.persons?.forEach(per => {
          nameList.push(per.name);
        });

        return (
          <div>
            <Text id={'nameList'} text={`name list: ${nameList.join(' ')}`} />
          </div>
        );
      }
    }

    Horizon.render(<App parent={Parent} child={Child} />, container);

    expect(container.querySelector('#nameList').innerHTML).toBe('name list: p1 p2');
    // push
    globalStore.$state.persons.push(newPerson);
    expect(container.querySelector('#nameList').innerHTML).toBe('name list: p1 p2 p3');

    // shift
    globalStore.$state.persons.shift({ name: 'p0', age: 0 });
    expect(container.querySelector('#nameList').innerHTML).toBe('name list: p2 p3');

    // 赋值[2]
    globalStore.$state.persons[2] = { name: 'p4', age: 4 };
    expect(container.querySelector('#nameList').innerHTML).toBe('name list: p2 p3 p4');

    // 重新赋值[2]
    globalStore.$state.persons[2] = { name: 'p5', age: 5 };
    expect(container.querySelector('#nameList').innerHTML).toBe('name list: p2 p3 p5');

    // unshift
    globalStore.$state.persons.unshift({ name: 'p1', age: 1 });
    expect(container.querySelector('#nameList').innerHTML).toBe('name list: p1 p2 p3 p5');

    // 重新赋值 null
    globalStore.$state.persons = null;
    expect(container.querySelector('#nameList').innerHTML).toBe('name list: ');

    // 重新赋值 [{ name: 'p1', age: 1 }]
    globalStore.$state.persons = [{ name: 'p1', age: 1 }];
    expect(container.querySelector('#nameList').innerHTML).toBe('name list: p1');
  });
});