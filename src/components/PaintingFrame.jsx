import React, { useMemo, useRef, useState } from 'react';
import { Text, Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCanvasStore } from '../stores/useCanvasStore';

const getArtworkData = (entry) => {
  if (!entry) return null;
  if (typeof entry === 'string') {
    return {
      imageData: entry,
      title: 'Untitled',
      artist: 'Anonymous',
      description: '',
    };
  }

  return {
    imageData: entry.imageData ?? '',
    title: entry.title?.trim() || 'Untitled',
    artist: entry.artist?.trim() || 'Anonymous',
    description: entry.description?.trim() || '',
  };
};

export const PaintingFrame = ({ position, rotation, name }) => {
  const setActiveCanvas = useCanvasStore((state) => state.setActiveCanvas);
  const activeCanvas = useCanvasStore((state) => state.activeCanvas);
  const artwork = getArtworkData(useCanvasStore((state) => state.paintings[name]));
  const groupRef = useRef();
  const { camera } = useThree();
  const [isClose, setIsClose] = useState(false);
  const pointerDownTime = useRef(0);

  useFrame(() => {
    if (groupRef.current) {
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      // Only check distance if they are pointing at it or we just check always?
      // Since there are many canvases, checking distance every frame is fine
      // But we can limit it to 7 units
      const currentlyClose = worldPos.distanceTo(camera.position) < 7;
      if (currentlyClose !== isClose) {
        setIsClose(currentlyClose);
      }
    }
  });

  const texture = useMemo(() => {
    if (!artwork?.imageData) return null;

    const img = new Image();
    img.src = artwork.imageData;

    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    img.onload = () => {
      tex.needsUpdate = true;
    };

    return tex;
  }, [artwork?.imageData]);

  const isEditable = name.startsWith('station') || !artwork?.imageData;

  const handlePointerDown = (event) => {
    if (!isEditable) return;
    pointerDownTime.current = Date.now();
  };

  const handleClick = (event) => {
    event.stopPropagation();
    if (!isEditable) return;
    // Only open if the click was short (not holding to walk)
    if (Date.now() - pointerDownTime.current < 300) {
      if (event.distance < 7) {
        setActiveCanvas(name);
      }
    }
  };

  return (
    <group position={position} rotation={rotation} ref={groupRef}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.6, 3.4, 0.1]} />
        <meshStandardMaterial color={0x111111} roughness={0.4} metalness={0.1} />
      </mesh>

      <mesh receiveShadow position={[0, 0, 0.055]}>
        <planeGeometry args={[2.4, 3.2]} />
        <meshStandardMaterial color={0xf8f8f8} roughness={1} />
      </mesh>

      <mesh
        position={[0, 0, 0.058]}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onPointerOver={() => {
          if (isEditable) document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <planeGeometry args={[1.8, 2.4]} />
        {texture ? (
          <meshStandardMaterial color={0xffffff} roughness={1} map={texture} />
        ) : (
          <meshStandardMaterial color={0xffffff} roughness={1} />
        )}
      </mesh>

      {/* Floor Indicator Circle */}
      <mesh position={[0, -2.19, 3]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.7, 32]} />
        <meshBasicMaterial color={isClose ? 0xffea00 : 0xffffff} transparent opacity={isClose ? 0.8 : 0.4} />
      </mesh>

      {isClose && !activeCanvas && isEditable && (
        <Html position={[0, 0, 0.06]} center style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.3)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
            Click to Paint
          </div>
        </Html>
      )}

      {texture && (
        <>
          <pointLight position={[0, 0.65, 0.55]} color={0xfff5e6} intensity={2.3} distance={6} />

          <group position={[-2.1, -0.2, 0.09]}>
            <mesh receiveShadow>
              <boxGeometry args={[1.2, 0.85, 0.04]} />
              <meshStandardMaterial color={0xe7dcc3} roughness={0.82} metalness={0.08} />
            </mesh>

            <Text
              position={[0, 0.28, 0.03]}
              maxWidth={1.0}
              fontSize={0.09}
              color={0x231d16}
              anchorX="center"
              anchorY="middle"
            >
              {artwork.title}
            </Text>

            <Text
              position={[0, 0.14, 0.03]}
              maxWidth={1.0}
              fontSize={0.065}
              color={0x5a4b36}
              anchorX="center"
              anchorY="middle"
            >
              {`by ${artwork.artist}`}
            </Text>

            <Text
              position={[0, -0.06, 0.03]}
              maxWidth={1.1}
              fontSize={0.045}
              lineHeight={1.3}
              color={0x6d614f}
              anchorX="center"
              anchorY="middle"
            >
              {artwork.description}
            </Text>
          </group>
        </>
      )}
    </group>
  );
};
