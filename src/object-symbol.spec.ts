import * as test from "blue-tape";
import { getSymbolForObject } from "./object-symbol";

test("getSymbolForObject", async t => {
    const o1 = {};
    const o2 = {};

    const s1 = getSymbolForObject(o1);
    const s2 = getSymbolForObject(o2);
    t.notEqual(s1, s2);

    t.strictEqual(s1, getSymbolForObject(o1));
    t.strictEqual(s2, getSymbolForObject(o2));
});
