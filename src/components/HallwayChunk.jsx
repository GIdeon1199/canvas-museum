import React, { useMemo } from 'react';
import * as THREE from 'three';
import { PaintingFrame } from './PaintingFrame';

const CHUNK_LENGTH = 40;
const HALL_WIDTH = 20;
const WALL_HEIGHT = 12;

export const HallwayChunk = ({ chunkIndex, zBasis }) => {
  // We use useMemo to hold onto the light targets so they aren't recreated every render
  const targets = useMemo(() => {
    const tL1 = new THREE.Object3D(); tL1.position.set(-HALL_WIDTH / 2, 2.2, -10);
    const tR1 = new THREE.Object3D(); tR1.position.set(HALL_WIDTH / 2, 2.2, -10);
    const tL2 = new THREE.Object3D(); tL2.position.set(-HALL_WIDTH / 2, 2.2, 10);
    const tR2 = new THREE.Object3D(); tR2.position.set(HALL_WIDTH / 2, 2.2, 10);
    return { tL1, tR1, tL2, tR2 };
  }, []);

  return (
    <group position={[0, 0, zBasis]}>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[HALL_WIDTH, CHUNK_LENGTH]} />
        <meshStandardMaterial color={0xcccccc} roughness={0.9} metalness={0.1} />
      </mesh>
      
      {/* Ceiling */}
      <mesh position={[0, WALL_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALL_WIDTH, CHUNK_LENGTH]} />
        <meshStandardMaterial color={0xeeeeee} roughness={1.0} />
      </mesh>

      {/* Walls */}
      <mesh position={[-HALL_WIDTH / 2, WALL_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[CHUNK_LENGTH, WALL_HEIGHT]} />
        <meshStandardMaterial color={0xffffff} roughness={1.0} />
      </mesh>
      <mesh position={[HALL_WIDTH / 2, WALL_HEIGHT / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[CHUNK_LENGTH, WALL_HEIGHT]} />
        <meshStandardMaterial color={0xffffff} roughness={1.0} />
      </mesh>

      {/* Canvases and Lights */}
      {/* Left 1 */}
      <primitive object={targets.tL1} />
      <spotLight position={[-HALL_WIDTH / 2 + 2, 6, -10]} color={0xfff5e0} intensity={80} angle={Math.PI / 3.5} penumbra={0.7} decay={2} distance={15} target={targets.tL1} />
      <PaintingFrame name={`canvas_${chunkIndex}_l0`} position={[-HALL_WIDTH / 2 + 0.1, 2.2, -10]} rotation={[0, Math.PI / 2, 0]} />

      {/* Right 1 */}
      <primitive object={targets.tR1} />
      <spotLight position={[HALL_WIDTH / 2 - 2, 6, -10]} color={0xfff5e0} intensity={80} angle={Math.PI / 3.5} penumbra={0.7} decay={2} distance={15} target={targets.tR1} />
      <PaintingFrame name={`canvas_${chunkIndex}_r0`} position={[HALL_WIDTH / 2 - 0.1, 2.2, -10]} rotation={[0, -Math.PI / 2, 0]} />

      {/* Left 2 */}
      <primitive object={targets.tL2} />
      <spotLight position={[-HALL_WIDTH / 2 + 2, 6, 10]} color={0xfff5e0} intensity={80} angle={Math.PI / 3.5} penumbra={0.7} decay={2} distance={15} target={targets.tL2} />
      <PaintingFrame name={`canvas_${chunkIndex}_l1`} position={[-HALL_WIDTH / 2 + 0.1, 2.2, 10]} rotation={[0, Math.PI / 2, 0]} />

      {/* Right 2 */}
      <primitive object={targets.tR2} />
      <spotLight position={[HALL_WIDTH / 2 - 2, 6, 10]} color={0xfff5e0} intensity={80} angle={Math.PI / 3.5} penumbra={0.7} decay={2} distance={15} target={targets.tR2} />
      <PaintingFrame name={`canvas_${chunkIndex}_r1`} position={[HALL_WIDTH / 2 - 0.1, 2.2, 10]} rotation={[0, -Math.PI / 2, 0]} />

    </group>
  );
};
