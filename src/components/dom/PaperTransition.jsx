import { useEffect, useRef, useMemo } from 'react';
import gsap from 'gsap';
import { useScene } from '../../context/useScene';
import { useAudio } from '../../context/useAudio';
import '../../styles/Preloader.scss'; // Reuse preloader styles

/**
 * PaperTransition - Reusable paper tear transition for teleportation
 * 
 * Listens to SceneContext teleportPhase:
 * - 'closing': Paper halves slide together (reverse of tear)
 * - 'teleporting': Paper is closed, waiting for destination load
 * - 'opening': Paper tears apart revealing new room
 */

// Reusable SVG Line Component (copied from Preloader)
const TearLineSVG = ({ svgPathData }) => (
    <svg
        className="preloader__overlay"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ pointerEvents: 'none' }}
    >
        <path
            d={svgPathData}
            fill="none"
            stroke="#1a1a1a"
            strokeWidth="0.1"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const PaperTransition = () => {
    const {
        teleportPhase,
        teleportTarget,
        startTeleportTransition,
        finishPaperOpen,
        isFastTeleport
    } = useScene();
    const { play } = useAudio();

    const containerRef = useRef(null);
    const leftHalfRef = useRef(null);
    const rightHalfRef = useRef(null);
    const timelineRef = useRef(null);
    const fastTeleportRef = useRef(false);
    const galleryTeleportRef = useRef(false);

    // Generate tear path (same logic as Preloader)
    const tearPoints = useMemo(() => {
        const points = [];
        const segments = 12;

        points.push([50, 0]);

        for (let i = 1; i < segments; i++) {
            const y = (i / segments) * 100;
            const xOffset = (Math.random() - 0.5) * 6;
            const x = 50 + xOffset;
            points.push([x, y]);
        }

        points.push([50, 100]);
        return points;
    }, []);

    const svgPathData = useMemo(() => {
        return tearPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]} `).join(' ');
    }, [tearPoints]);

    const leftClipPoly = useMemo(() => {
        let poly = '0% 0%, ';
        tearPoints.forEach(p => { poly += `${p[0]}% ${p[1]}%, `; });
        poly += '0% 100%';
        return `polygon(${poly})`;
    }, [tearPoints]);

    const rightClipPoly = useMemo(() => {
        let poly = '100% 0%, ';
        poly += '100% 100%, ';
        [...tearPoints].reverse().forEach(p => { poly += `${p[0]}% ${p[1]}%, `; });
        return `polygon(${poly.slice(0, -2)})`;
    }, [tearPoints]);

    // Handle teleport phases
    useEffect(() => {
        if (!leftHalfRef.current || !rightHalfRef.current || !containerRef.current) return;

        // Kill any existing timeline
        if (timelineRef.current) {
            timelineRef.current.kill();
        }

        // 快速传送（地图/画廊点击）已有静态首帧兜底，纸张转场可以更短。
        // signalRoomReady 会提前清掉 isFastTeleport，因此用 ref 记住本次传送模式。
        if (teleportPhase === 'closing') {
            fastTeleportRef.current = isFastTeleport;
            galleryTeleportRef.current = isFastTeleport && teleportTarget === 'gallery';
        }
        const fastMode = isFastTeleport || fastTeleportRef.current;
        const skipPaper = galleryTeleportRef.current;
        const closeDuration = fastMode ? 0.35 : 0.8;
        const openDuration = fastMode ? 0.6 : 1.2;

        if (teleportPhase === 'closing') {
            // 快速传送（画廊）：静态首帧已经接管转场，直接开始相机传送，
            // 不再播放纸张合上，避免额外约 1 秒等待。
            if (skipPaper) {
                startTeleportTransition();
                return undefined;
            }

            // Show container
            gsap.set(containerRef.current, { opacity: 1, display: 'block' });

            // Start with halves apart (like at end of preloader)
            gsap.set(leftHalfRef.current, { xPercent: -100, rotation: -2 });
            gsap.set(rightHalfRef.current, { xPercent: 100, rotation: 2 });

            // Animate halves together
            timelineRef.current = gsap.timeline({
                onComplete: () => {
                    startTeleportTransition(); // Move to 'teleporting' phase
                }
            });

            // Play paper sound
            play('tear', { volume: 0.6 });

            timelineRef.current.to(leftHalfRef.current, {
                xPercent: 0,
                rotation: 0,
                duration: closeDuration,
                ease: "power2.inOut"
            }, 'close');

            timelineRef.current.to(rightHalfRef.current, {
                xPercent: 0,
                rotation: 0,
                duration: closeDuration,
                ease: "power2.inOut"
            }, 'close');
        }

        if (teleportPhase === 'teleporting') {
            // Paper is closed, TeleportRoom is loading the destination
            // TeleportRoom will call openTeleportTransition() when room is ready
            // No action needed here - just wait
        }

        if (teleportPhase === 'opening') {
            // 快速传送：房间已由首帧遮住，直接完成，等首帧淡出到 3D
            if (skipPaper) {
                finishPaperOpen();
                return undefined;
            }

            // Tear the paper apart
            timelineRef.current = gsap.timeline({
                onComplete: () => {
                    finishPaperOpen(); // Just clear the phase - teleport logic already done
                }
            });

            play('tear', { volume: 0.8 });

            timelineRef.current.to(leftHalfRef.current, {
                xPercent: -100,
                rotation: -2,
                duration: openDuration,
                ease: "power3.inOut"
            }, 'tear');

            timelineRef.current.to(rightHalfRef.current, {
                xPercent: 100,
                rotation: 2,
                duration: openDuration,
                ease: "power3.inOut"
            }, 'tear');

            // Fade out container at end
            timelineRef.current.to(containerRef.current, {
                opacity: 0,
                duration: 0.3,
                onComplete: () => {
                    gsap.set(containerRef.current, { display: 'none' });
                }
            }, '-=0.3');
        }

        return () => {
            if (timelineRef.current) {
                timelineRef.current.kill();
            }
        };
    }, [teleportPhase, teleportTarget, startTeleportTransition, finishPaperOpen, play, isFastTeleport]);

    // 组件始终留在 DOM（不 "return null"），
    // 避免复杂 SVG 路径首次加载时卡顿。
    return (
        <div
            className="preloader"
            ref={containerRef}
            style={{ pointerEvents: 'none', display: 'none' }} // DOM starts hidden
        >
            {/* LEFT HALF */}
            <div
                className="preloader__half preloader__half--left"
                ref={leftHalfRef}
                style={{ clipPath: leftClipPoly }}
            >
                <TearLineSVG svgPathData={svgPathData} />
            </div>

            {/* RIGHT HALF */}
            <div
                className="preloader__half preloader__half--right"
                ref={rightHalfRef}
                style={{ clipPath: rightClipPoly }}
            >
                <TearLineSVG svgPathData={svgPathData} />
            </div>
        </div>
    );
};

export default PaperTransition;
