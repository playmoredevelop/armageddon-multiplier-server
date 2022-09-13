import { BasicRoom } from "./BasicRoom";

export class TwoOnTwoRoom extends BasicRoom {

    protected _birdsPerClient = 2
    protected _roundTimeInterval = 20 * 1000

    public roomName = '2on2'
    public maxClients = 4
}