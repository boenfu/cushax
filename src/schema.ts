import { Module } from "vuex";

export function Schema<S extends Module<any, any>>(s: S): S {
  return s;
}

export let schema = Schema({
  state: {
    user: "boen",
  },
  mutations: {
    changeUser(state: any, user: any) {
      state.user = user;
    },

    changeUser2(state: any, user: undefined) {
      state.user = user;
    },
  },
  modules: {
    foo: {
      state: {
        $params: {
          id: "111",
          age: 0,
        },
        $query: {
          size: "1",
          pages: "2",
        },
        $event: {
          save: { name: "" },
        },
        age: 18,
        name: "",
      },
      mutations: {
        changeAge(state: any, age: number) {
          state.age = age;
        },
        setName(state: any, name: string) {
          state.name = name;
        },
      },
    },
    bar: {
      state: {
        length: 18,
      },
      mutations: {
        changeLength(state: any, length: number) {
          state.length = length;
        },
      },
    },
  },
});

export type TestSchema = typeof schema;
