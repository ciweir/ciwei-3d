import { useMemo, memo, Suspense } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

import CorridorWalls from './CorridorWalls';
import DoorSection from './DoorSection';
import SegmentDoors from './SegmentDoors';
import Avatar from './Avatar';
import HeroText from './HeroText';
import Doodles from './Doodles';
import CorridorDecorations from './CorridorDecorations';

/**
 * CorridorSegment Component
 * 
 * A single repeatable chunk of the infinite corridor.
 * Each segment contains: walls, avatar, 「此唯」 hero text, doors, decorations.
 * 
 * Segment length: 80 units
 * Positioned based on segmentIndex * segmentLength
 */
const SEGMENT_LENGTH = 80;

// Sawtooth Geometry Constants (Shared with CorridorWalls logic conceptually)
const WALL_X_OUTER = 3.5;
const WALL_X_INNER = 1.7;
const DOOR_Z_SPAN = 4;
// Angle of the wall relative to the corridor axis
const WALL_ANGLE = Math.atan2(WALL_X_OUTER - WALL_X_INNER, DOOR_Z_SPAN);


const CorridorSegment = ({
    segmentIndex = 0,
    onDoorEnter,
    hideSegmentDoors = false, // Hide only SegmentDoors while keeping content preloaded
    zClip = 100000, // Clipping plane (render everything with Z < zClip)
    setCameraOverride, // Function to take over camera control
    soloRoom = null // 深链直连：只挂目标房间的门与房间，墙体/装饰等延后补挂
}) => {

    // Calculate Z offset based on segment index
    // Segment 0 starts at Z=10, goes to Z=-70
    const zOffset = 10 - (segmentIndex * SEGMENT_LENGTH);

    // Door positions within this segment (relative to segment start)
    const doors = useMemo(() => {
        const doorDefs = [
            {
                id: `gallery-${segmentIndex}`,
                roomId: 'gallery',
                relativeZ: -18,
                side: 'left',
                label: 'THE GALLERY',
                icon: '◈',
                color: '#f5efe6'
            },
            {
                id: `studio-${segmentIndex}`,
                roomId: 'studio',
                relativeZ: -32,
                side: 'right',
                label: 'THE STUDIO',
                icon: '▶',
                color: '#e6f5ef'
            },
            {
                id: `about-${segmentIndex}`,
                roomId: 'about',
                relativeZ: -48,
                side: 'left',
                label: 'THE ABOUT',
                icon: '★',
                color: '#efe6f5',
                enterDistance: 25 // Enter deep into the room (clouds are far back)
            },
            {
                id: `connect-${segmentIndex}`,
                roomId: 'contact',
                relativeZ: -62,
                side: 'right',
                label: "LET'S CONNECT",
                icon: '✉',
                color: '#f5e6e6'
            },
        ];

        return doorDefs.map(def => {
            // Calculate adjusted Position and Rotation for Sawtooth Walls
            const xBase = (WALL_X_OUTER + WALL_X_INNER) / 2; // Midpoint of the angled wall
            const xPos = def.side === 'left' ? -xBase : xBase;

            // Rotation:
            // Left Wall: Normal was (1,0,0) [RotY 90]. Now angle it towards camera (+Z).
            // Rotate Clockwise by WALL_ANGLE.
            // Right Wall: Normal was (-1,0,0) [RotY -90]. Angle towards camera (+Z).
            // Rotate Counter-Clockwise by WALL_ANGLE.

            const baseRot = def.side === 'left' ? Math.PI / 2 : -Math.PI / 2;
            const rotOffset = def.side === 'left' ? -WALL_ANGLE : WALL_ANGLE;

            return {
                ...def,
                x: xPos,
                rotation: baseRot + rotOffset
            };
        });
    }, [segmentIndex]);

    // 深链 solo：只保留目标房间那扇门
    const visibleDoors = soloRoom ? doors.filter((door) => door.roomId === soloRoom) : doors;

    return (
        <group position={[0, 0, 0]}>
            {/* === CORRIDOR WALLS === */}
            {/* 独立 Suspense 边界：solo 模式延后补挂墙体/装饰时，已显示的门与房间不会被一起挂起 */}
            {!soloRoom && (
                <Suspense fallback={null}>
                    {/* Pass door positions so walls can generate gaps/angles correctly */}
                    <CorridorWalls
                        zStart={zOffset}
                        length={SEGMENT_LENGTH}
                        doorPositions={doors}
                        zClip={zClip}
                    />

                    {/* === WELCOME AREA (Start of segment) - MOVED CLOSER === */}
                    <group position={[0, 0, zOffset - 2]}>
                        {/* 「此唯」Hero Text - centered (letters adjusted internally)
                            z=+0.4：头像照片满铺 Avatar 面片（z=-0.3）后，文字必须在其前方 */}
                        <HeroText position={[0, -0.1, 0.4]} />

                        {/* Avatar - center */}
                        <Avatar position={[0, -0.61, -0.3]} />


                        {/* Doodles around avatar */}
                        <Doodles />

                        {/* Segment number (debug - can remove later) */}
                        <Text
                            position={[1.7, 1.4, 0.3]}
                            fontSize={0.12}
                            color="#ccc"
                            anchorX="center"
                            font="/fonts/NotoSansSC-3D.woff"
                        >
                            #{segmentIndex}
                        </Text>
                    </group>

                    <CorridorDecorations
                        segmentLength={SEGMENT_LENGTH}
                        zOffset={zOffset}
                        corridorWidth={WALL_X_OUTER * 2}
                        corridorHeight={3.5}
                        zClip={zClip}
                        setCameraOverride={setCameraOverride}
                    />
                </Suspense>
            )}

            {/* === DOOR SECTIONS (wall + door + label as one unit) === */}
            {/* Hidden during entrance animation for segment -1 */}
            {!hideSegmentDoors && visibleDoors.map((door) => (
                <DoorSection
                    key={door.id}
                    position={[
                        door.x,
                        0,
                        zOffset + door.relativeZ + 2
                    ]}
                    side={door.side}
                    label={door.label}
                    roomId={door.roomId}
                    icon={door.icon}
                    color={door.color}
                    enterDistance={door.enterDistance}
                    onEnter={() => onDoorEnter?.(door.roomId)}
                    setCameraOverride={setCameraOverride}
                    segmentIndex={segmentIndex}
                />
            ))}

            {/* === LIGHTING === */}
            {/* pointLight removed for optimization as it didn't affect visuals significantly */}

            {/* === SEGMENT END DOORS (hidden during entrance) === */}
            {!soloRoom && !hideSegmentDoors && (
                <SegmentDoors
                    position={[0, 0, zOffset - SEGMENT_LENGTH + 5]}
                    corridorHeight={3.5}
                />
            )}
        </group>
    );
};

const MemoizedCorridorSegment = memo(CorridorSegment);

export { SEGMENT_LENGTH, WALL_X_OUTER, WALL_X_INNER, DOOR_Z_SPAN };
export default MemoizedCorridorSegment;
