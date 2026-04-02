import React, { useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { PaintingFrame } from './PaintingFrame';
import { HallwayChunk } from './HallwayChunk';
import { useCanvasStore } from '../stores/useCanvasStore';
import * as THREE from 'three';

const CHUNK_LENGTH = 40;
const hallWidth = 20;
const wallHeight = 12;

export const MuseumScene = () => {
  const { camera } = useThree();
  const [activeChunkIndex, setActiveChunkIndex] = useState(0);
  const setTotalCanvases = useCanvasStore(state => state.setTotalCanvases);

  // Track player progress to spawn new chunks
  useFrame(() => {
    // Dynamic chunk 0 spans z from -40 to 0. Center is -20.
    // Dynamic chunk 1 spans z from 0 to 40. Center is 20.
    // Index = Math.floor((camera.position.z + 40) / 40)
    const z = camera.position.z;
    const index = Math.max(0, Math.floor((z + 40) / 40));
    if (index !== activeChunkIndex) {
      setActiveChunkIndex(index);
    }
  });

  // Calculate which chunks to render to keep performance high
  const visibleChunks = useMemo(() => {
    const list = [];
    // Render current chunk, plus 1 behind, plus 2 ahead
    for (let i = Math.max(0, activeChunkIndex - 1); i <= activeChunkIndex + 2; i++) {
        list.push(i);
    }
    return list;
  }, [activeChunkIndex]);

  // Entrance lights targets
  const entranceTargets = useMemo(() => {
    const targetL_station = new THREE.Object3D(); targetL_station.position.set(-hallWidth / 2, 2.2, -65);
    const targetR_station = new THREE.Object3D(); targetR_station.position.set(hallWidth / 2, 2.2, -65);
    const titleTarget = new THREE.Object3D(); titleTarget.position.set(0, 6, -80);
    return { targetL_station, targetR_station, titleTarget };
  }, []);

  useEffect(() => {
    // Set an arbitrary large number to trick UI until we refactor it if needed,
    // though the UI doesn't explicitly display the total anymore.
    setTotalCanvases(1000);
  }, [setTotalCanvases]);

  return (
    <group>
      <ambientLight color={0xf5f0e8} intensity={0.06} />
      <hemisphereLight skyColor={0xdedcf7} groundColor={0x3a3632} intensity={0.15} />

      {/* Entrance Section (z = -80 to -40) */}
      <group position={[0, 0, -60]}>
        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[hallWidth, 40]} />
          <meshStandardMaterial color={0xcccccc} roughness={0.9} metalness={0.1} />
        </mesh>
        
        {/* Walls */}
        <mesh position={[-hallWidth / 2, wallHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
          <planeGeometry args={[40, wallHeight]} />
          <meshStandardMaterial color={0xffffff} roughness={1.0} />
        </mesh>
        <mesh position={[hallWidth / 2, wallHeight / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
          <planeGeometry args={[40, wallHeight]} />
          <meshStandardMaterial color={0xffffff} roughness={1.0} />
        </mesh>

        {/* The Back Wall behind Spawn */}
        <mesh position={[0, wallHeight / 2, -20]} receiveShadow>
          <planeGeometry args={[hallWidth, wallHeight]} />
          <meshStandardMaterial color={0xffffff} roughness={1.0} />
        </mesh>

        {/* Ceiling */}
        <mesh position={[0, wallHeight, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[hallWidth, 40]} />
          <meshStandardMaterial color={0xeeeeee} roughness={1.0} />
        </mesh>

        {/* Title Graphics */}
        <group position={[0, 8, -19.5]}>
          <Text fontSize={2} color={0x111111} anchorX="center" anchorY="bottom">The Kunstraum</Text>
          <Text position={[0, -2.5, 0]} fontSize={0.8} color={0x333333} anchorX="center">Observation. Minimalism. Naturalism.</Text>
          <Text position={[0, -4.0, 0]} fontSize={0.5} color={0x555555} anchorX="center">Walk. Paint. Display.</Text>
        </group>
      </group>

      {/* Title Graphic Light */}
      <primitive object={entranceTargets.titleTarget} />
      <spotLight position={[0, wallHeight - 1, -72]} color={0xfff8f0} intensity={60} penumbra={0.6} decay={2} distance={20} target={entranceTargets.titleTarget} />

      {/* Creation Stations (Permanently at Entrance: z = -65) */}
      <primitive object={entranceTargets.targetL_station} />
      <spotLight position={[-hallWidth / 2 + 2, 6, -65]} color={0xfff5e0} intensity={80} angle={Math.PI / 3.5} penumbra={0.7} decay={2} distance={15} target={entranceTargets.targetL_station} castShadow />
      <PaintingFrame name="station_1" position={[-hallWidth / 2 + 0.1, 2.2, -65]} rotation={[0, Math.PI / 2, 0]} />

      <primitive object={entranceTargets.targetR_station} />
      <spotLight position={[hallWidth / 2 - 2, 6, -65]} color={0xfff5e0} intensity={80} angle={Math.PI / 3.5} penumbra={0.7} decay={2} distance={15} target={entranceTargets.targetR_station} castShadow />
      <PaintingFrame name="station_2" position={[hallWidth / 2 - 0.1, 2.2, -65]} rotation={[0, -Math.PI / 2, 0]} />

      {/* Render Infinite Pipeline of Chunks */}
      {visibleChunks.map(idx => (
        <HallwayChunk key={`chunk_${idx}`} chunkIndex={idx} zBasis={idx * CHUNK_LENGTH - 20} />
      ))}
    </group>
  );
};
