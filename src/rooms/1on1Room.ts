import { BasicRoom } from "./BasicRoom";

export class OneOnOneRoom extends BasicRoom {

    protected _birdsPerClient = 4

    public roomName = '1on1'
    public maxClients = 2
}