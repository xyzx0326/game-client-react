import {useCallback, useEffect, useState} from 'react';
import {getClient, Room} from "./client";


export const useOnline = () => {
    const [, trigger] = useState(Math.random());
    const client = getClient();

    const listener = useCallback(() => trigger(Math.random()), [])

    useEffect(() => {
        client.setListener(listener);
        return () => client.removeListener(listener);
    }, [listener])

    const room = client.getRoom();

    return {
        ...room
    } as Room;
}
