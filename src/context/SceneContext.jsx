import { createContext, useState, useCallback, useMemo, useRef } from 'react';
import { getInitialRoomFromUrl } from '../hooks/useDocumentMeta';

const SceneContext = createContext(null);

export const SceneProvider = ({ children }) => {
    // Deep linking: check if URL points to a specific room on first load
    const initialRoom = useRef(getInitialRoomFromUrl());
    const deeplinkHandled = useRef(false);

    const [currentRoom, setCurrentRoom] = useState(null); // null = corridor, 'about', 'portfolio', etc.
    const [hasEntered, setHasEntered] = useState(false);  // Has user clicked entrance doors?
    const [exitRequested, setExitRequested] = useState(false); // Signal to request exit from room
    const [overlayContent, setOverlayContent] = useState(null); // Content for overlay (Studio monitor etc)
    const [readingProject, setReadingProject] = useState(null); // 阅读室（批次 2）：当前深读的项目
    // 房间首个可见帧（上色/贴图就绪）才撤入口海报，避免导航先出现、画面还在白屏
    const [roomVisualReady, setRoomVisualReady] = useState(null);

    // Teleportation states
    const [teleportTarget, setTeleportTarget] = useState(null); // Room ID to teleport to
    const [isTeleporting, setIsTeleporting] = useState(false);  // Currently in teleport transition
    const [teleportPhase, setTeleportPhase] = useState(null);   // 'closing' | 'teleporting' | 'opening' | null
    const [pendingDoorClick, setPendingDoorClick] = useState(null); // Label of door to click after teleport
    const [isFastTeleport, setIsFastTeleport] = useState(false); // Fast teleport in progress (skip animations)
    // 传送/深链进房：纸面和首帧海报已遮住等待，房间不该再跑一遍笔刷上色
    const teleportEntryRef = useRef(false);
    const [enteredViaTeleport, setEnteredViaTeleport] = useState(false);

    // Inspecting state removed to avoid global re-renders

    const enterRoom = useCallback((roomId) => {
        setCurrentRoom(roomId);
        setEnteredViaTeleport(teleportEntryRef.current);
        setExitRequested(false); // Clear any pending exit request
        setOverlayContent(null); // Clear overlay on room change

        // Teleportation cleanup - if we just teleported in
        // Note: isFastTeleport is cleared by signalRoomReady, not here
        // Don't clear teleportPhase if it's 'opening' - let the paper animation complete
        setIsTeleporting(false);
        setPendingDoorClick(null);
        // teleportPhase is cleared by finishPaperOpen after animation
    }, []);

    const exitRoom = useCallback(() => {
        setCurrentRoom(null);
        setExitRequested(false);
        setOverlayContent(null);
        setRoomVisualReady(null);
        teleportEntryRef.current = false;
        setEnteredViaTeleport(false);
    }, []);

    // Request exit - this signals to DoorSection to trigger exit animation
    const requestExit = useCallback(() => {
        setExitRequested(true);
        setOverlayContent(null);
        setRoomVisualReady(null);
        teleportEntryRef.current = false;
        setEnteredViaTeleport(false);
    }, []);

    const markRoomVisualReady = useCallback((roomId) => {
        setRoomVisualReady(roomId);
        if (typeof performance !== 'undefined') {
            performance.mark(`ciwei:room-visual-ready:${roomId}`);
        }
    }, []);

    // Clear exit request - called by DoorSection after handling
    const clearExitRequest = useCallback(() => {
        setExitRequested(false);
    }, []);

    const markEntered = useCallback(() => {
        setHasEntered(true);
    }, []);

    const openOverlay = useCallback((content) => {
        setOverlayContent(content);
    }, []);

    const closeOverlay = useCallback(() => {
        setOverlayContent(null);
    }, []);

    /* 阅读室（批次 2）：打开时收起摘要层 */
    const openReadingRoom = useCallback((project) => {
        setOverlayContent(null);
        setReadingProject(project);
    }, []);

    const closeReadingRoom = useCallback(() => {
        setReadingProject(null);
    }, []);

    // Teleportation functions

    // Initiate teleport - called when user clicks room on map
    const teleportTo = useCallback((roomId) => {
        if (isTeleporting || roomId === currentRoom) return; // Prevent double teleport or same room

        setTeleportTarget(roomId);
        setIsTeleporting(true);
        setIsFastTeleport(true); // Enable fast teleport mode
        setTeleportPhase('closing'); // Paper starts closing
        setOverlayContent(null);
        setRoomVisualReady(null);
        teleportEntryRef.current = true;
        setEnteredViaTeleport(true);
    }, [isTeleporting, currentRoom]);

    // Called when paper close animation completes - actually move camera
    const startTeleportTransition = useCallback(() => {
        setTeleportPhase('teleporting');
        // Camera will be moved here by listening components
    }, []);

    // Called when teleport is ready (room loaded) - start paper open animation
    // During fast teleport, this is called AFTER camera is inside room
    const openTeleportTransition = useCallback(() => {
        setTeleportPhase('opening');
    }, []);

    // Called when paper open animation completes - cleanup
    const completeTeleport = useCallback(() => {
        // During FAST teleport: paper stays closed, trigger door click immediately
        // The paper will open when signalRoomReady() is called by DoorSection
        setPendingDoorClick(teleportTarget);

        // Don't clear isTeleporting yet! Wait for enterRoom() logic to finish
        // We only clear target here (phase cleared later)
        setTeleportTarget(null);
        // Note: teleportPhase stays at 'teleporting' during fast teleport so paper remains closed
    }, [teleportTarget]);

    // Called by DoorSection when camera has finished entering the room during fast teleport
    // This opens the paper and completes the teleport sequence
    const signalRoomReady = useCallback(() => {
        if (isFastTeleport) {
            // Now open the paper
            setTeleportPhase('opening');
            setIsFastTeleport(false);
        }
    }, [isFastTeleport]);

    // Called by PaperTransition when paper open animation finishes
    // This just clears the phase - teleport logic is already done
    const finishPaperOpen = useCallback(() => {
        setTeleportPhase(null);
    }, []);

    // REMOVED clearPendingDoorClick - it's now handled in enterRoom

    // Cancel teleport (in case of error)
    const cancelTeleport = useCallback(() => {
        setTeleportTarget(null);
        setIsTeleporting(false);
        setTeleportPhase(null);
        setPendingDoorClick(null);
        setIsFastTeleport(false);
        setRoomVisualReady(null);
        teleportEntryRef.current = false;
        setEnteredViaTeleport(false);
    }, []);

    const value = useMemo(() => ({
        currentRoom,
        hasEntered,
        exitRequested,
        roomVisualReady,
        markRoomVisualReady,
        overlayContent, // Exposed
        readingProject, // 阅读室（批次 2）
        openReadingRoom, // Exposed
        closeReadingRoom, // Exposed
        enterRoom,
        exitRoom,
        requestExit,
        clearExitRequest,
        markEntered,
        openOverlay,    // Exposed
        closeOverlay,   // Exposed
        isInRoom: currentRoom !== null,
        // Deep linking
        initialRoom: initialRoom.current,
        deeplinkHandled,
        // Teleportation
        teleportTarget,
        isTeleporting,
        teleportPhase,
        pendingDoorClick,
        isFastTeleport,
        enteredViaTeleport,
        teleportTo,
        startTeleportTransition,
        openTeleportTransition,
        completeTeleport,
        signalRoomReady,
        finishPaperOpen,
        cancelTeleport,
    }), [
        currentRoom,
        hasEntered,
        exitRequested,
        roomVisualReady,
        markRoomVisualReady,
        overlayContent,
        readingProject,
        openReadingRoom,
        closeReadingRoom,
        enterRoom,
        exitRoom,
        requestExit,
        clearExitRequest,
        markEntered,
        openOverlay,
        closeOverlay,
        // Teleportation dependencies
        teleportTarget,
        isTeleporting,
        teleportPhase,
        pendingDoorClick,
        isFastTeleport,
        enteredViaTeleport,
        teleportTo,
        startTeleportTransition,
        openTeleportTransition,
        completeTeleport,
        signalRoomReady,
        finishPaperOpen,
        cancelTeleport
    ]);

    return (
        <SceneContext.Provider value={value}>
            {children}
        </SceneContext.Provider>
    );
};

export default SceneContext;
