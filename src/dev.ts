import Cushax from "./app";
import { TestSchema } from "./schema";
import SocketIO from "socket.io";

const io = SocketIO();

io.listen(80);

let cushax = new Cushax<TestSchema>(io);

cushax.page({
  name: "foo",
  async enter({ params }, page) {
    console.log(params);

    cushax.commit("changeUser", "boen" + Math.round(Math.random() * 600));

    await new Promise((r) =>
      setTimeout(() => {
        r();
      }, 4000)
    );

    page.commit("changeAge", 18);
  },
  update({ params: { age } }, page) {
    page.commit("changeAge", age);
  },
  leave() {
    console.log("foo leave");
  },
});

cushax.page({
  name: "bar",
  enter({}, page) {
    console.log("bar enter");

    page.commit("changeLength", 666);
  },
});
