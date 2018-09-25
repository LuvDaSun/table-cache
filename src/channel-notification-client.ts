import { Disposable, DisposableComposition } from "dispose";
import { DatabaseNotificationPool } from "./database-notification-pool";

export type ChannelNotificationListener = (payload: any) => void;

export class ChannelNotificationClient extends DisposableComposition {

    public static async create(
        notificationPool: DatabaseNotificationPool,
        channel: string,
    ) {
        const instance = new ChannelNotificationClient(notificationPool, channel);
        await instance.initialize();
        return instance;
    }

    private readonly listeners = new Set<ChannelNotificationListener>();
    private constructor(
        private notificationPool: DatabaseNotificationPool,
        private channel: string,
    ) {
        super();
    }

    public listen(listener: ChannelNotificationListener): Disposable {
        this.listeners.add(listener);
        const dispose = () => {
            this.listeners.delete(listener);
        };
        return { dispose };
    }

    private async initialize() {
        const notificationClient = await this.notificationPool.lease({});
        const { client } = notificationClient;
        await client.query(`LISTEN ${this.channel}`);
        this.registerDisposable({
            dispose: async () => {
                await client.query(`UNLISTEN ${this.channel}`);
                await notificationClient.dispose();
            },
        });

        const listener = notificationClient.listen(this.notificationHandler);
        this.registerDisposable(listener);
    }

    private notificationHandler = (channel: string, payload: object | null) => {
        if (channel !== this.channel) return;
        this.notifyListeners(payload);
    }

    private notifyListeners(payload: any) {
        this.listeners.forEach(listener => listener(payload));
    }

}
