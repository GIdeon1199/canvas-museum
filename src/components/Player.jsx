import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { useCanvasStore } from '../stores/useCanvasStore';

const BASE_EYE_HEIGHT = 1.6;
const HEAD_BOB_SPEED = 8;
const HEAD_BOB_AMOUNT = 0.012;

export const Player = () => {
  const { camera } = useThree();
  const controlsRef = useRef();
  
  const proxyCamera = useMemo(() => {
    const cam = new THREE.PerspectiveCamera();
    if (!useCanvasStore.getState().hasPlayedIntro) {
      cam.position.set(0, 30, -75);
      cam.rotation.set(-Math.PI / 2, 0, 0);
    } else {
      cam.position.copy(camera.position);
      cam.quaternion.copy(camera.quaternion);
    }
    return cam;
  }, [camera]);
  
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  
  const input = useRef({ forward: false, backward: false });
  const headBobTime = useRef(0);
  const introTimer = useRef(0);
  
  const activeCanvas = useCanvasStore(state => state.activeCanvas);
  const setIsLocked = useCanvasStore(state => state.setIsLocked);
  const shouldRelock = useCanvasStore(state => state.shouldRelock);
  const clearRelockRequest = useCanvasStore(state => state.clearRelockRequest);
  const hasPlayedIntro = useCanvasStore(state => state.hasPlayedIntro);
  const setHasPlayedIntro = useCanvasStore(state => state.setHasPlayedIntro);
  
  const isMobile = useCanvasStore(state => state.isMobile);
  const isMobileWalking = useCanvasStore(state => state.isMobileWalking);
  const hasStartedMobile = useCanvasStore(state => state.hasStartedMobile);
  const teleportTarget = useCanvasStore(state => state.teleportTarget);
  const setTeleportTarget = useCanvasStore(state => state.setTeleportTarget);

  const touchEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const lastTouch = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (teleportTarget) {
      proxyCamera.position.set(teleportTarget.x, BASE_EYE_HEIGHT, teleportTarget.z);
      const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, teleportTarget.rotationY, 0));
      proxyCamera.quaternion.copy(targetQuat);
      
      camera.position.copy(proxyCamera.position);
      camera.quaternion.copy(proxyCamera.quaternion);

      if (isMobile) {
        touchEuler.current.setFromQuaternion(proxyCamera.quaternion, 'YXZ');
      }
      setTeleportTarget(null);
    }
  }, [teleportTarget, proxyCamera, camera, isMobile, setTeleportTarget]);

  useEffect(() => {
    if (hasPlayedIntro) proxyCamera.position.y = BASE_EYE_HEIGHT;

    const onMouseDown = (e) => {
      if (!controlsRef.current?.isLocked) return;
      if (e.button === 0) input.current.forward = true;
      else if (e.button === 2) input.current.backward = true;
    };
    
    const onMouseUp = (e) => {
      if (e.button === 0) input.current.forward = false;
      else if (e.button === 2) input.current.backward = false;
    };
    
    const onWheel = (e) => {
      if (!controlsRef.current?.isLocked) return;
      
      const scrollForce = 3;
      if (e.deltaY < 0) velocity.current.z -= scrollForce;
      else if (e.deltaY > 0) velocity.current.z += scrollForce;

      // Clamp max scroll velocity to prevent trackpad/mouse hyper-speed
      if (velocity.current.z < -12) velocity.current.z = -12;
      if (velocity.current.z > 12) velocity.current.z = 12;
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('wheel', onWheel);

    const onTouchStart = (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('#mobile-walk-btn') || e.target.closest('.drawing-ui-overlay')) return;
      lastTouch.current.x = e.touches[0].pageX;
      lastTouch.current.y = e.touches[0].pageY;
    };

    const onTouchMove = (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('#mobile-walk-btn') || e.target.closest('.drawing-ui-overlay')) return;
      if (!hasStartedMobile) return;
      
      const dx = e.touches[0].pageX - lastTouch.current.x;
      const dy = e.touches[0].pageY - lastTouch.current.y;
      lastTouch.current.x = e.touches[0].pageX;
      lastTouch.current.y = e.touches[0].pageY;

      touchEuler.current.y -= dx * 0.005;
      touchEuler.current.x -= dy * 0.005;
      touchEuler.current.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, touchEuler.current.x));
      
      proxyCamera.quaternion.setFromEuler(touchEuler.current);
    };

    if (isMobile) {
      document.addEventListener('touchstart', onTouchStart, { passive: false });
      document.addEventListener('touchmove', onTouchMove, { passive: false });
    }

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('wheel', onWheel);
      if (isMobile) {
        document.removeEventListener('touchstart', onTouchStart);
        document.removeEventListener('touchmove', onTouchMove);
      }

      // Release pointer lock if the player unmounts while controls are active.
      if (controlsRef.current?.isLocked) controlsRef.current.unlock();
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [camera, isMobile, hasStartedMobile, proxyCamera, hasPlayedIntro]);

  useFrame((state, delta) => {
    if (!hasPlayedIntro) {
      introTimer.current += delta;
      const progress = Math.min(introTimer.current / 2.5, 1.0);
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic

      const startPos = new THREE.Vector3(0, 30, -75);
      const targetPos = new THREE.Vector3(0, BASE_EYE_HEIGHT, -75);
      proxyCamera.position.lerpVectors(startPos, targetPos, ease);

      const startRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
      const targetRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
      proxyCamera.quaternion.slerpQuaternions(startRot, targetRot, ease);

      camera.position.copy(proxyCamera.position);
      camera.quaternion.copy(proxyCamera.quaternion);

      if (progress === 1.0) {
        setHasPlayedIntro(true);
        if (isMobile) {
           touchEuler.current.setFromQuaternion(proxyCamera.quaternion, 'YXZ');
        }
      }
      return;
    }

    if (!isMobile && !controlsRef.current?.isLocked) return;
    if (isMobile && !hasStartedMobile) return;
    if (activeCanvas) return; // Prevent movement when canvas is active

    velocity.current.x -= velocity.current.x * 10.0 * delta;
    velocity.current.z -= velocity.current.z * 10.0 * delta;

    const fwd = isMobile ? isMobileWalking : input.current.forward;
    direction.current.z = Number(fwd) - Number(input.current.backward);
    direction.current.normalize();

    if (fwd || input.current.backward) {
      velocity.current.z -= direction.current.z * 40.0 * delta;
    }

    proxyCamera.updateMatrix();
    
    if (!isMobile) {
      controlsRef.current?.moveRight(-velocity.current.x * delta);
      controlsRef.current?.moveForward(-velocity.current.z * delta);
    } else {
      const vec = new THREE.Vector3();
      vec.setFromMatrixColumn(proxyCamera.matrix, 0);
      proxyCamera.position.addScaledVector(vec, -velocity.current.x * delta);
      
      vec.setFromMatrixColumn(proxyCamera.matrix, 0);
      vec.crossVectors(proxyCamera.up, vec);
      proxyCamera.position.addScaledVector(vec, -velocity.current.z * delta);
    }

    const isMoving = fwd || input.current.backward || Math.abs(velocity.current.z) > 1.0;
    
    if (isMoving && proxyCamera.position.y >= BASE_EYE_HEIGHT - 0.1 && proxyCamera.position.y <= BASE_EYE_HEIGHT + 0.1) {
      headBobTime.current += delta * HEAD_BOB_SPEED;
      const bobY = Math.sin(headBobTime.current) * HEAD_BOB_AMOUNT;
      proxyCamera.position.y = BASE_EYE_HEIGHT + bobY;
    } else {
      proxyCamera.position.y += (BASE_EYE_HEIGHT - proxyCamera.position.y) * 0.1;
      headBobTime.current = 0;
    }

    const pos = proxyCamera.position;
    const hallWidth = 20;
    const hallLength = 160;
    const colHallWidth = (hallWidth / 2) - 0.6;
    const colHallLength = (hallLength / 2) - 1;

    if (pos.x > colHallWidth) pos.x = colHallWidth;
    if (pos.x < -colHallWidth) pos.x = -colHallWidth;
    
    // Endless forward walking (+Z). Only back wall is enforced (-Z: spawn area)
    if (pos.z < -colHallLength) pos.z = -colHallLength;

    camera.position.lerp(proxyCamera.position, 10 * delta);
    camera.quaternion.slerp(proxyCamera.quaternion, 10 * delta);
  });

  useEffect(() => {
    if (activeCanvas) {
      input.current.forward = false;
      input.current.backward = false;
      velocity.current.set(0, 0, 0);

      if (controlsRef.current?.isLocked) controlsRef.current.unlock();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [activeCanvas]);

  useEffect(() => {
    if (!shouldRelock || activeCanvas) return;

    const frameId = requestAnimationFrame(() => {
      controlsRef.current?.lock();
      clearRelockRequest();
    });

    return () => cancelAnimationFrame(frameId);
  }, [activeCanvas, clearRelockRequest, shouldRelock]);

  if (isMobile) return null;

  return <PointerLockControls 
    ref={controlsRef} 
    camera={proxyCamera}
    onLock={() => setIsLocked(true)} 
    onUnlock={() => setIsLocked(false)} 
  />;
};
