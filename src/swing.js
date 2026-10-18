export const SWING_TIME = 0.36

export function poseSwing(group, restX, restY, restZ, rotX, rotY, rotZ, swingTime) {
  const u = 1 - swingTime / SWING_TIME
  const strike = Math.sin(u * Math.PI)
  group.position.x = restX + 0.26 - u * 0.58
  group.position.y = restY + 0.04 + strike * 0.06
  group.position.z = restZ - strike * 0.22
  group.rotation.x = rotX + 0.5 - strike * 0.85
  group.rotation.y = rotY + 0.9 - u * 2.1
  group.rotation.z = rotZ + 0.35 - u * 1.05
}
