import { Server } from "net";

import { Observable } from "babylonjs";
import { Nullable } from "babylonjs-editor/shared/types";
import { IQuixelExport } from "./types";

export class QuixelServer {
    /**
     * Defines the reference to the local server.
     */
    public static Server: Nullable<Server> = null;
    /**
     * Defines the port of the local server.
     */
    public static Port: number = 24981;

    /**
     * Notifies the observers that an asset has been exported in Bridge from Quixel.
     */
    public static OnExportedAssetObservable: Observable<IQuixelExport[]> = new Observable<IQuixelExport[]>();
    
    /**
     * Connects to the server.
     */
    public static Connect(): void {
        if (this.IsConnected) { return; }
        
        this.Server = new Server((s) => {
            s.on("data", (d: Buffer) => {
                const json = JSON.parse(d.toString("utf-8"));
                this.OnExportedAssetObservable.notifyObservers(json);
            });
        });
        this.Server.listen(this.Port);
    }

    /**
     * Restarts the local server.
     */
    public static async Restart(): Promise<void> {
        if (this.Server) {
            await new Promise<void>((resolve) => this.Server!.close(() => resolve()));
        }

        this.Connect();
    }

    /**
     * Gets wether or not the server is already listening.
     */
    public static get IsConnected(): boolean {
        return this.Server?.listening ?? false;
    }
}
