import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

const START_DELAY = 1200;

const HeroVideoScreen = ({ src, width, height, depth, position, active }) => {
    const materialRef = useRef();
    const videoRef = useRef();
    const textureRef = useRef();
    const activeRef = useRef(active);
    activeRef.current = active;

    const reveal = useCallback(() => {
        if (!materialRef.current) return;
        gsap.to(materialRef.current, {
            opacity: 1,
            duration: 0.55,
            ease: 'power1.out',
            overwrite: true,
        });
    }, []);

    useEffect(() => {
        if (!src) return undefined;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
        if (navigator.connection?.saveData) return undefined;

        const material = materialRef.current;
        let cancelled = false;
        let video = null;
        let texture = null;
        let timer = null;

        const bindCrop = () => {
            if (!texture || !video?.videoWidth || !video?.videoHeight) return;
            const videoAspect = video.videoWidth / video.videoHeight;
            const faceAspect = width / height;
            const repeatX = videoAspect > faceAspect ? faceAspect / videoAspect : 1;
            const repeatY = videoAspect < faceAspect ? videoAspect / faceAspect : 1;
            texture.repeat.set(repeatX, repeatY);
            texture.offset.set((1 - repeatX) / 2, (1 - repeatY) / 2);
        };

        const setup = () => {
            if (cancelled) return;
            video = document.createElement('video');
            video.src = src;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.preload = 'auto';
            // iOS 对游离 video 元素较保守；挂到 DOM（不可见）再播放更稳
            video.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
            document.body.appendChild(video);

            texture = new THREE.VideoTexture(video);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;

            video.addEventListener('loadedmetadata', bindCrop);
            video.addEventListener('canplay', () => {
                if (cancelled) return;
                bindCrop();
                if (activeRef.current) {
                    video.play().then(() => {
                        if (!cancelled) reveal();
                    }).catch(() => {});
                }
            });

            videoRef.current = video;
            textureRef.current = texture;
            if (material) {
                material.map = texture;
                material.needsUpdate = true;
            }
            video.load();
        };

        timer = window.setTimeout(setup, START_DELAY);

        return () => {
            cancelled = true;
            if (timer) window.clearTimeout(timer);
            if (video) {
                video.pause();
                video.removeAttribute('src');
                video.load();
                video.remove();
            }
            if (texture) texture.dispose();
            if (material) {
                material.map = null;
                material.needsUpdate = true;
            }
            videoRef.current = null;
            textureRef.current = null;
        };
    }, [src, width, height, reveal]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        if (active) {
            if (video.readyState >= 2) {
                video.play().then(() => {
                    if (activeRef.current) reveal();
                }).catch(() => {});
            }
        } else {
            video.pause();
        }
    }, [active, reveal]);

    return (
        <group position={position}>
            <mesh position={[0, 0, depth / 2 + 0.003]} raycast={() => null}>
                <planeGeometry args={[width * 0.985, height * 0.985]} />
                <meshBasicMaterial
                    ref={materialRef}
                    transparent
                    opacity={0}
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
        </group>
    );
};

export default HeroVideoScreen;
