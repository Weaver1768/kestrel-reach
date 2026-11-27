import * as THREE from 'three';
import { clamp, approach } from './util.js';

export function createCameraRig(camera, canvas) {
  let mode = 'chase', yaw = 0, pitch = 0, zoom = 0, cinematic = 0;
  const velocity = new THREE.Vector3(), targetPosition = new THREE.Vector3(), local = new THREE.Vector3();
  const forward = new THREE.Vector3(), up = new THREE.Vector3(), look = new THREE.Vector3();
  const springError = new THREE.Vector3(), springStep = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0), freeLook = new THREE.Euler(0, 0, 0, 'YXZ');
  const placeCockpit = (state) => {
    camera.position.copy(state.position).add(local.set(0, 1.62, -3.05).applyQuaternion(state.orientation));
    camera.quaternion.copy(state.orientation);
    camera.fov = 72; camera.updateProjectionMatrix();
  };
  const setLookTarget = (state) => {
    forward.set(0, 0, -1).applyQuaternion(state.orientation);
    up.set(0, 1, 0).applyQuaternion(state.orientation);
    look.copy(state.position).addScaledVector(forward, 26).addScaledVector(up, 1.5);
  };
  const getChaseTarget = (state, terrain) => {
    const speed = state.velocity.length();
    const distance = clamp(26 + speed * 0.055, 30, 52) * (1 + zoom);
    const height = 7.5 + Math.min(6, speed * 0.012);
    local.set(2.2, height, distance).applyQuaternion(state.orientation);
    targetPosition.copy(state.position).add(local);
    targetPosition.y = Math.max(targetPosition.y, terrain.heightAt(targetPosition.x, targetPosition.z) + 4);
    return targetPosition;
  };
  const clampAboveTerrain = (terrain) => {
    const floor = terrain.heightAt(camera.position.x, camera.position.z) + 4;
    if (camera.position.y < floor) { camera.position.y = floor; if (velocity.y < 0) velocity.y = 0; }
  };

  return {
    get mode() { return mode; },
    setMode(next) { mode = next; yaw = 0; pitch = 0; },
    cycle() { mode = mode === 'chase' ? 'cockpit' : mode === 'cockpit' ? 'cinematic' : 'chase'; yaw = 0; pitch = 0; },
    snap(state, terrain) {
      velocity.set(0, 0, 0);
      if (mode === 'cockpit') { placeCockpit(state); return; }
      if (mode === 'cinematic') {
        local.set(0, 12, 42).applyAxisAngle(worldUp, Math.sin(cinematic * 0.11));
        targetPosition.copy(state.position).add(local);
        targetPosition.y = Math.max(targetPosition.y, terrain.heightAt(targetPosition.x, targetPosition.z) + 4);
      } else getChaseTarget(state, terrain);
      camera.position.copy(targetPosition); clampAboveTerrain(terrain);
      setLookTarget(state); camera.lookAt(look);
      camera.fov = mode === 'cinematic' ? 52 : 60; camera.updateProjectionMatrix();
    },
    update(dt, state, input, terrain) {
      if (input.cameraPressed) this.cycle();
      zoom = clamp(zoom + input.wheel * 0.08, -0.35, 0.6);
      if (mode === 'cockpit') {
        yaw = clamp(yaw - input.mouseX * 0.0026, -1.2, 1.2);
        pitch = clamp(pitch - input.mouseY * 0.0021, -0.72, 0.62);
        local.set(0, 1.62, -3.05).applyQuaternion(state.orientation); camera.position.copy(state.position).add(local);
        freeLook.set(pitch, yaw, 0, 'YXZ'); camera.quaternion.copy(state.orientation).multiply(new THREE.Quaternion().setFromEuler(freeLook));
        camera.fov = approach(camera.fov, 72, 3.5, dt); camera.updateProjectionMatrix(); return;
      }

      if (mode === 'cinematic') {
        cinematic += dt;
        local.set(0, 12, 42).applyAxisAngle(worldUp, Math.sin(cinematic * 0.11));
        targetPosition.copy(state.position).add(local);
        targetPosition.y = Math.max(targetPosition.y, terrain.heightAt(targetPosition.x, targetPosition.z) + 4);
      } else getChaseTarget(state, terrain);

      const omega = Math.sqrt(6.0), decay = Math.exp(-omega * dt);
      springError.copy(camera.position).sub(targetPosition);
      springStep.copy(velocity).addScaledVector(springError, omega).multiplyScalar(dt);
      camera.position.copy(targetPosition).addScaledVector(springError.add(springStep), decay);
      velocity.addScaledVector(springStep, -omega).multiplyScalar(decay);
      clampAboveTerrain(terrain);
      setLookTarget(state);
      if (yaw || pitch) look.add(new THREE.Vector3(0, 0, -70).applyQuaternion(state.orientation).applyAxisAngle(worldUp, yaw).applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch));
      camera.lookAt(look);
      if (state.buffet > 0) {
        camera.position.x += Math.sin(state.missionTime * 74) * state.buffet * 0.18;
        camera.position.y += Math.sin(state.missionTime * 91) * state.buffet * 0.12;
        clampAboveTerrain(terrain);
      }
      camera.fov = approach(camera.fov, mode === 'cinematic' ? 52 : 60, 2, dt); camera.updateProjectionMatrix();
    },
  };
}
