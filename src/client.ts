import {nanoid} from "nanoid";
import {CacheUtils} from "./cache";

let defaultClient: GameClient;

export const configClient = (url: string, option?: RoomOption, module: string = 'default') => {
    if (!defaultClient) {
        defaultClient = new GameClient(url, module)
        option && defaultClient.setOption(option)
    }
    return defaultClient;
}

export const getClient = () => {
    return defaultClient;
}

export const addRoom = (roomId?: string, playerId?: string) => {
    return defaultClient.addRoom(roomId, playerId);
}

export const configRoom = (option: RoomOption) => {
    return defaultClient.configRoom(option);
}

export const sendAction = (data: any) => {
    return defaultClient.sendAction(data)
}

export const leaveRoom = () => {
    return defaultClient.leaveRoom()
}

export const resetAction = () => {
    return defaultClient.resetAction()
}

export default class GameClient {

    private readonly url: string
    private readonly module: string
    private socket?: WebSocket;
    private timer: any
    private option?: RoomOption

    private playerId: string
    private roomId?: string

    private listeners: Function[]

    private room?: Room

    constructor(url: string, module: string) {
        this.url = url;
        this.module = module;
        this.playerId = CacheUtils.getItem(`${module}_playerId`);
        if (!this.playerId) {
            const playerId = nanoid();
            this.playerId = playerId;
            CacheUtils.setItem(`${module}_playerId`, playerId)
        }
        this.listeners = [];
    }

    getRoom() {
        return this.room;
    }

    setOption(option: RoomOption) {
        this.option = {...this.option, ...option}
    }

    setListener(listener: Function) {
        this.listeners.push(listener)
    }

    removeListener(listener: Function) {
        this.listeners = this.listeners.filter(v => v !== listener)
    }

    updateListener() {
        this.listeners.forEach(v => v());
    }

    addRoom(roomId: string = nanoid(), playerId?: string) {
        this.roomId = roomId;
        if (playerId) {
            this.playerId = playerId!;
            CacheUtils.setItem(`${this.module}_playerId`, this.playerId)
        }
        this.createSocket(() => {
            this.send(requestActions.ADD_ROOM, {roomId, playerId: this.playerId})
        })
    }

    createSocket(cb?: Function) {
        const responseActions = {
            SYNC_ACTION: this.syncAction.bind(this),
            SYNC_CONFIG: this.syncConfig.bind(this),
            CONNECTED: this.createRoom.bind(this),
            ROOM_INFO: this.updateRoom.bind(this),
            LEAVE_PLAYER: this.updatePlayerOffline.bind(this),
            JOIN_PLAYER: this.updatePlayerOnline.bind(this),
            RESET_ACTION: this.resetActionResp.bind(this)
        }

        this.socket = new WebSocket(this.url);
        this.socket.onopen = () => {
            cb && cb()
            this.timer = setInterval(() => {
                this.send("h", {roomId: this.roomId, playerId: this.playerId})
            }, 5000);
        };
        this.socket.onmessage = (e: MessageEvent) => {
            e.data.text().then((str: string) => {
                const data: Message = JSON.parse(str)
                console.log(data)
                responseActions[data.type as (keyof typeof responseActions)](data.data)
                this.updateListener()
            })
        };

        this.socket.onclose = (e: CloseEvent) => {
            clearInterval(this.timer)
        };
    }

    configRoom(option?: RoomOption) {
        option && this.setOption(option);
        this.send(requestActions.CONFIG_ROOM, this.option);
    }

    sendAction(data: any) {
        this.send(requestActions.SYNC_ACTION, data);
    }

    leaveRoom() {
        this.socket?.close()
        this.socket = undefined;
        this.room = undefined;
        this.roomId = undefined;
        clearInterval(this.timer)
    }

    resetAction() {
        this.send(requestActions.REQUEST_ACTION);
    }

    private createRoom(data: Player) {
        this.room = {
            id: data.id,
            isOwner: data.owner,
            isPlayer: data.player,
            myIndex: data.index,
            playerCount: 1,
            players: [data]
        }
        while (this.option && this.room.players.length < this.option.maxPlayer!) {
            this.room.players.push({} as Player)
        }
        if (this.room.isOwner && this.option && data.create) {
            this.configRoom()
        }
        console.log(this)
    }

    private updateRoom(data: any) {
        this.room = {
            ...this.room!,
            ...data
        }
        console.log(this)
    }

    private updatePlayerOnline(data: Player) {
        if (this.room && data.player) {
            this.room.players[data.index] = data
            this.room.playerCount += 1
        }
        console.log(this)
    }

    private updatePlayerOffline(data: Player) {
        if (this.room && data.player) {
            this.room.players[data.index] = {} as Player
            this.room.playerCount -= 1
        }
        console.log(this)
    }

    private send(type: string, data?: any) {
        this.socket && this.socket.send(blobData({type, data: JSON.stringify(data)}))
    }

    private syncConfig(data: any) {
        const callback = this.option && this.option.configCallback;
        callback && callback(data)
    }

    private syncAction(data: any) {
        const callback = this.option && this.option.actionCallback;
        callback && callback(data)
    }

    private resetActionResp(data: any) {
        const callback = this.option && this.option.resetCallback;
        callback && callback(data)
    }

}

type Message<T = any> = {
    type: string
    data: T
}

export type RoomOption = {
    maxPlayer?: number,
    baseConfig?: any[],
    playerConfig?: any[][],
    configCallback?: Function,
    actionCallback?: Function,
    resetCallback?: Function
}

export type Room = {
    id: string
    isOwner: boolean
    isPlayer: boolean
    myIndex: number
    playerCount: number
    players: Player[]
}

export type Player = {
    id: string
    name: string
    index: number
    owner: boolean
    player: boolean
    online: boolean
    create?: boolean
}

const blobData = (data: any) => {
    return new Blob([JSON.stringify(data)])
}

const requestActions = {
    ADD_ROOM: "ADD_ROOM",
    CONFIG_ROOM: "CONFIG_ROOM",
    RESET_ACTION: "RESET_ACTION",
    SYNC_ACTION: "SYNC_ACTION",
    REQUEST_ACTION: "REQUEST_ACTION",
    LOCK_PLAYER: "LOCK_PLAYER",
    UNLOCK_PLAYER: "UNLOCK_PLAYER",
}
