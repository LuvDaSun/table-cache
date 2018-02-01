import * as test from "blue-tape";
import { Disposable } from "using-disposable";
import { ObjectPool } from "./object-pool";

class Dummy implements Disposable {
    public static create(value: string) {
        return new Dummy(value);
    }

    public isDisposed = false;
    private constructor(public value: string) {

    }

    public dispose() {
        if (this.isDisposed) return;
        this.isDisposed = true;
    }
}

test("object-pool", async t => {
    const pool = new ObjectPool(
        ([value]: [string]) => Dummy.create(value),
        (...args: any[]) => args,
    );

    const d = await pool.lease(["a"]);
    const d1 = await pool.lease(["a"]);
    t.equal(d1, d);

    await d.dispose();
    t.equal(d.isDisposed, false);

    await d.dispose();
    t.equal(d.isDisposed, false);

    const d2 = await pool.lease(["a"]);
    t.equal(d2, d);
    t.equal(d.isDisposed, false);

    await d1.dispose();
    await d2.dispose();
    t.equal(d.isDisposed, true);

    const d3 = await pool.lease(["a"]);
    t.notEqual(d3, d);

    pool.dispose();
    t.equal(d3.isDisposed, true);
});
