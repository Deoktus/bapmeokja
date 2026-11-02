import { useEffect, useRef } from 'react';
import {
  BLOCK_SIZE,
  BLOCK_TOP,
  DUCK_FEET_Y,
  DUCK_W,
  GROUND_Y,
  ITEMS,
  ITEM_SIZE,
  JUMP_HEIGHT,
  SCALE,
  SPARK_COLORS,
  STAGE_H,
  drawBlock,
  drawDuck,
  drawEllipsisBubble,
  drawGloom,
  drawItem,
  drawSpark,
  drawTear,
} from './sprites.js';

const WALK_SPEED = 22;
const APPROACH_SPEED = 32;
const EDGE = 16;
const JUMP_DURATION = 0.55;
const LEAVE_DURATION = 0.5;
const BUMP_DURATION = 0.2;
const REACTIONS = ['happy', 'frustrated', 'reluctant'];
const REACTION_DURATION = { happy: 2.6, frustrated: 2.8, reluctant: 3.2 };
// 좋아하는 게 걸리면 1개, 싫은 게 걸리면 1개, 둘 다 싫으면 2개가 나온다
const REACTION_ITEMS = { happy: ['burger'], frustrated: ['broccoli'], reluctant: ['broccoli', 'eggplant'] };

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const easeOut = (p) => 1 - (1 - p) ** 3;

// 마리오 풍 무대: 오리가 걸어 다니다가 ? 블록을 치고, 나온 음식에 따라 세 가지 반응 중 하나를 보여 준다
export default function Stage() {
  const sceneRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const s = {
      width: 0,
      mode: 'walk',
      t: 0,
      wait: rand(2, 4),
      x: 60,
      dir: 1,
      frame: 0,
      frameT: 0,
      jumpY: 0,
      bumped: false,
      block: null,
      reaction: null,
      itemsT: 0,
      fade: 1,
    };

    function setMode(next) {
      s.mode = next;
      s.t = 0;
      scene.dataset.state = next;
    }

    function moveBy(dx) {
      s.x += dx;
      if (s.x < EDGE) {
        s.x = EDGE;
        s.dir = 1;
      } else if (s.x > s.width - EDGE) {
        s.x = s.width - EDGE;
        s.dir = -1;
      }
    }

    function spawnBlock() {
      let x = s.x;
      for (let attempt = 0; attempt < 10 && Math.abs(x - s.x) < 40; attempt += 1) {
        x = rand(EDGE + 10, Math.max(EDGE + 10, s.width - EDGE - 10));
      }
      s.block = { x, alpha: 0, used: false, bumpT: -1 };
      setMode('to-block');
    }

    function update(dt) {
      s.t += dt;
      s.frameT += dt;
      const frameDuration = s.mode === 'react-reluctant' ? 0.4 : s.mode === 'react-frustrated' ? 0.15 : 0.18;
      if (s.frameT >= frameDuration) {
        s.frameT = 0;
        s.frame += 1;
      }
      if (s.block && s.block.bumpT >= 0) s.block.bumpT += dt;
      if (s.bumped) s.itemsT += dt;

      if (s.mode === 'walk') {
        moveBy(s.dir * WALK_SPEED * dt);
        if (s.t >= s.wait) spawnBlock();
      } else if (s.mode === 'to-block') {
        s.block.alpha = Math.min(1, s.block.alpha + dt * 2.5);
        const dx = s.block.x - s.x;
        const step = APPROACH_SPEED * dt;
        s.dir = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) <= step) {
          s.x = s.block.x;
          setMode('jump');
        } else {
          s.x += s.dir * step;
        }
      } else if (s.mode === 'jump') {
        const p = Math.min(1, s.t / JUMP_DURATION);
        s.jumpY = -JUMP_HEIGHT * 4 * p * (1 - p);
        if (!s.bumped && p >= 0.5) {
          s.bumped = true;
          s.itemsT = 0;
          s.block.used = true;
          s.block.bumpT = 0;
          s.reaction = pick(REACTIONS);
        }
        if (p >= 1) {
          s.jumpY = 0;
          setMode(`react-${s.reaction}`);
        }
      } else if (s.mode.startsWith('react-')) {
        if (s.t >= REACTION_DURATION[s.reaction]) setMode('leave');
      } else if (s.mode === 'leave') {
        s.fade = 1 - Math.min(1, s.t / LEAVE_DURATION);
        if (s.t >= LEAVE_DURATION) {
          s.block = null;
          s.reaction = null;
          s.bumped = false;
          s.fade = 1;
          s.dir = Math.random() < 0.5 ? 1 : -1;
          s.wait = rand(3, 6);
          setMode('walk');
        }
      }
    }

    function drawBlockAndItems() {
      if (!s.block) return;
      ctx.globalAlpha = s.block.alpha * (s.mode === 'leave' ? s.fade : 1);

      // 아이템은 블록 뒤에서 위로 솟아오르도록 블록보다 먼저 그린다
      if (s.reaction && s.bumped) {
        const names = REACTION_ITEMS[s.reaction];
        const rise = easeOut(Math.min(1, s.itemsT / 0.35));
        names.forEach((name, i) => {
          const centerX = s.block.x + (names.length === 1 ? 0 : i === 0 ? -8 : 8);
          const bob = rise >= 1 ? Math.round(Math.sin(s.itemsT * 5 + i)) : 0;
          drawItem(ctx, ITEMS[name], Math.round(centerX - ITEM_SIZE / 2), BLOCK_TOP - 2 - Math.round(12 * rise) + bob);
        });
      }

      const bump = s.block.bumpT >= 0 ? -3 * Math.sin(Math.min(1, s.block.bumpT / BUMP_DURATION) * Math.PI) : 0;
      drawBlock(ctx, Math.round(s.block.x - BLOCK_SIZE / 2), BLOCK_TOP + Math.round(bump), s.block.used);
      ctx.globalAlpha = 1;
    }

    function drawDuckAndEffects() {
      const pose = { facing: s.dir, frame: s.frame, stand: true };
      let dx = 0;
      let dy = s.jumpY;

      if (s.mode === 'walk' || s.mode === 'to-block') {
        pose.stand = false;
        pose.bodyDY = s.frame % 2 === 0 ? 0 : -1;
      } else if (s.mode === 'jump') {
        pose.wingUp = true;
      } else if (s.mode === 'react-happy') {
        dy = -Math.round(Math.abs(Math.sin(s.t * 7)) * 5);
        pose.eyes = 'happy';
        pose.wingUp = Math.floor(s.t * 6) % 2 === 0;
      } else if (s.mode === 'react-frustrated') {
        dx = Math.floor(s.t * 14) % 2 === 0 ? 1 : -1;
        pose.eyes = 'sad';
        pose.headDY = 2;
        pose.droop = true;
      } else if (s.mode === 'react-reluctant') {
        dx = Math.round(Math.sin(s.t * 2) * 2);
        pose.eyes = 'meh';
        pose.headDY = 1;
        pose.droop = true;
        pose.sweat = true;
      }

      const boxX = Math.round(s.x + dx) - DUCK_W / 2;
      const boxY = GROUND_Y - DUCK_FEET_Y + dy;
      ctx.globalAlpha = 1;
      drawDuck(ctx, boxX, boxY, pose);

      if (s.mode === 'react-happy') {
        for (let k = 0; k < 4; k += 1) {
          const angle = s.t * 3 + (k * Math.PI) / 2;
          const color = SPARK_COLORS[(Math.floor(s.t * 8) + k) % 2];
          drawSpark(ctx, Math.round(s.x + Math.cos(angle) * 15), Math.round(boxY + 9 + Math.sin(angle) * 10), color);
        }
      } else if (s.mode === 'react-frustrated') {
        const eyeX = s.dir > 0 ? boxX + 12 : boxX + DUCK_W - 13;
        drawTear(ctx, eyeX, boxY + 10 + Math.floor((s.t * 10) % 6));
        drawTear(ctx, eyeX + (s.dir > 0 ? 1 : -1), boxY + 10 + Math.floor((s.t * 10 + 3) % 6));
        drawGloom(ctx, Math.round(s.x) - 5, boxY - 8, Math.floor(s.t * 8));
      } else if (s.mode === 'react-reluctant') {
        const bubbleX = s.dir > 0 ? boxX - 14 : boxX + DUCK_W + 1;
        drawEllipsisBubble(ctx, bubbleX, boxY + 2, 1 + (Math.floor(s.t * 2) % 3));
      }
    }

    function draw() {
      ctx.clearRect(0, 0, s.width, STAGE_H);
      drawBlockAndItems();
      drawDuckAndEffects();
    }

    function resize() {
      s.width = Math.max(1, Math.ceil(scene.clientWidth / SCALE));
      canvas.width = s.width;
      canvas.height = STAGE_H;
      s.x = clamp(s.x, EDGE, Math.max(EDGE, s.width - EDGE));
      if (s.block) s.block.x = clamp(s.block.x, EDGE, Math.max(EDGE, s.width - EDGE));
      draw();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(scene);
    scene.dataset.state = 'walk';
    resize();

    let frameId = 0;
    if (reduced) {
      s.x = s.width / 2;
      s.dir = 1;
      draw();
    } else {
      let last = performance.now();
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        update(dt);
        draw();
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="stage" ref={sceneRef} aria-hidden="true">
      <div className="ground" />
      <canvas className="stage-canvas" ref={canvasRef} />
    </div>
  );
}
