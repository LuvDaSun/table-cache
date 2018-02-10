import * as pg from "pg";
import { Disposable, DisposableComposition } from "using-disposable";

export type NotificationListener = (channel: string, payload: object | null) => void;

export class DatabaseNotificationClient extends DisposableComposition {

    public static async create(
        pool: pg.Pool,
    ) {
        const instance = new DatabaseNotificationClient(pool);
        await instance.initialize();
        return instance;
    }

    public client!: pg.Client;
    private readonly listeners = new Set<NotificationListener>();
    private constructor(
        private pool: pg.Pool,
    ) {
        super();
    }

    public listen(listener: NotificationListener): Disposable {
        this.listeners.add(listener);
        const dispose = () => {
            this.listeners.delete(listener);
        };
        return { dispose };
    }

    private async initialize() {
        this.client = await this.pool.connect();
        this.client.addListener("notification", this.notificationHandler);
        this.registerDisposable({
            dispose: () => {
                this.client.removeListener("notification", this.notificationHandler);
                this.client.release();
            },
        });
    }

    private notificationHandler = (message: {
        channel: string;
        payload: string;
    }) => {
        const channel = message.channel;
        let payload: object | null;
        try {
            payload = message.payload === "" ?
                null :
                JSON.parse(message.payload);
        }
        catch (err) {
            payload = null;
        }
        this.notifyListeners(channel, payload);
    }

    private notifyListeners(channel: string, payload: object | null) {
        this.listeners.forEach(listener => listener(channel, payload));
    }

}
