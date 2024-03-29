import {nanoid} from "nanoid";
import {CacheUtils} from "./cache";

let defaultClient: GameClient;

export const configClient = (url: string, option?: RoomOption, module: string = 'default') => {
    if (!defaultClient) {
        defaultClient = new GameClient(url, module)
        option = option ?? {}
        defaultClient.setOption({...option, module})
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

export const sendFrame = (data: any) => {
    return defaultClient.sendFrame(data)
}

export const leaveRoom = () => {
    return defaultClient.leaveRoom()
}

export const resetRoom = () => {
    return defaultClient.resetRoom()
}

export const seedCreate = (data: SeedData) => {
    return defaultClient.seedCreate(data)
}

export default class GameClient {

    private debug: boolean = false
    private readonly url: string
    private readonly module: string
    private socket?: WebSocket;
    private timer: any
    private option?: RoomOption

    private playerId: string
    private roomId?: string

    private listeners: Function[]

    private room?: Room
    private seedMap: any = {}

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

    getSeed(key: string = "main") {
        return this.seedMap[key]
    }

    getRoom() {
        return this.room;
    }

    setOption(option: RoomOption) {
        this.option = {...this.option, ...option}
        console.log(option);
        if (option.debug) {
            this.debug = option.debug
        }
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

    seedCreate(data: SeedData) {
        this.send(requestActions.SEED_CREATE, data)
    }

    createSocket(cb?: Function) {
        const responseActions = {
            SYNC_FRAME: this.syncFrame.bind(this),
            SYNC_CONFIG: this.syncConfig.bind(this),
            CONNECTED: this.createRoom.bind(this),
            ROOM_INFO: this.updateRoom.bind(this),
            LEAVE_PLAYER: this.updatePlayerOffline.bind(this),
            JOIN_PLAYER: this.updatePlayerOnline.bind(this),
            RESET_ROOM: this.resetRoomResponse.bind(this),
            SYNC_SEED: this.syncSeed.bind(this),
        }

        this.socket = new WebSocket(this.url);
        this.socket.onopen = () => {
            cb && cb()
        };
        this.socket.onmessage = (e: MessageEvent) => {
            e.data.text().then((str: string) => {
                const data: Message = JSON.parse(str)
                if (this.debug) {
                    console.log(data)
                }
                responseActions[data.type as (keyof typeof responseActions)](JSON.parse(data.data ?? "{}"))
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

    sendFrame(data: any) {
        this.send(requestActions.SYNC_FRAME, data);
    }

    leaveRoom() {
        this.socket?.close()
        this.socket = undefined;
        this.room = undefined;
        this.roomId = undefined;
        clearInterval(this.timer)
    }

    resetRoom() {
        this.send(requestActions.RESET_ROOM);
    }

    private createRoom(data: Player) {
        this.room = {
            id: data.id,
            playerId: data.id,
            isOwner: data.owner,
            isPlayer: data.player,
            myIndex: data.index,
            playerCount: 1,
            players: [data]
        }
        while (this.option && this.room!.players.length < this.option.maxPlayer!) {
            this.room!.players.push({} as Player)
        }
        if (this.room!.isOwner && this.option && data.create) {
            this.configRoom()
        }
        if (this.debug) {
            console.log(this)
        }
        this.timer = setInterval(() => {
            this.send("h", {roomId: this.roomId, playerId: this.playerId})
        }, 5000);
    }

    private send(type: string, data?: any) {
        const value = {type, data: JSON.stringify(data), timestamp: new Date().getTime()};
        if (this.debug && value.type !== "h") {
            console.log(value)
        }
        this.socket && this.socket.send(blobData(value))
    }

    private updateRoom(data: any) {
        this.room = {
            ...this.room!,
            ...data
        }
        if (this.debug) {
            console.log(this)
        }
    }

    private updatePlayerOnline(data: Player) {
        if (this.room && data.player) {
            this.room.players[data.index] = data
            this.room.playerCount += 1
        }
        if (this.debug) {
            console.log(this)
        }
    }

    private updatePlayerOffline(data: Player) {
        if (this.room && data.player) {
            this.room.players[data.index] = {} as Player
            this.room.playerCount -= 1
        }
        if (this.debug) {
            console.log(this)
        }
    }

    // 同步配置
    private syncConfig(data: any) {
        const callback = this.option && this.option.onConfig;
        callback && callback(data)
    }

    // 同步动作
    private syncFrame(data: any) {
        const callback = this.option && this.option.onFrame;
        callback && callback(data)
    }

    // 重置游戏
    private resetRoomResponse(data: any) {
        const callback = this.option && this.option.onReset;
        callback && callback(data)
    }

    private syncSeed(data: SeedData) {
        this.seedMap[data.code!] = data.data
        const callback = this.option && this.option.onSeed;
        callback && callback(data)
    }

}

type Message<T = any> = {
    type: string
    data: T
}

export type RoomOption = {
    maxPlayer?: number
    module?: string
    tags?: string[]
    baseConfig?: any[]
    playerConfig?: any[][]

    debug?: boolean
    onConfig?: Function
    onFrame?: Function
    onReset?: Function
    onSeed?: Function
}

export type Room = {
    id: string
    playerId: string
    isOwner: boolean
    isPlayer: boolean
    myIndex: number
    playerCount: number
    players: Player[]
}

export type SeedData = {
    code?: string
    count?: number
    start?: number
    step?: number
    result?: boolean
    data?: number[]
}

export type Player = {
    id: string
    name: string
    index: number
    owner: boolean
    player: boolean
    online: boolean
    create?: boolean
    configList?: string[]
}

const blobData = (data: any) => {
    const str = JSON.stringify(data);
    return new Blob([str])
}

const requestActions = {
    ADD_ROOM: "room.add",
    CONFIG_ROOM: "room.config",
    RESET_ROOM: "room.reset",
    SYNC_FRAME: "room.frame.sync",
    REQUEST_FRAME: "room.frame.request",
    LOCK_SEAT: "room.seat.lock",
    UNLOCK_SEAT: "room.seat.unlock",
    SEED_CREATE: "room.seed.create",
    SEED_ALLOT: "room.seed.allot",
}
