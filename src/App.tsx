import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import './App.css';

const VIEW_WIDTH = 360;
const VIEW_HEIGHT = 640;
const PLAYER_WIDTH = 64;
const PLAYER_HEIGHT = 78;
const START_PLAYER_X = 148;
const START_PLAYER_Y = 500;
const START_PLATFORM_X = 128;
const START_PLATFORM_Y = 580;
const GRAVITY = 0.42;
const MOVE_ACCEL = 1.1;
const MAX_SPEED_X = 7.2;
const MAX_FALL_SPEED = 15;
const JUMP_VELOCITY = -10.6;
const SUPER_JUMP_VELOCITY = -16.8;
const PLATFORM_BUFFER = 960;
const PLATFORM_PRUNE_MARGIN = 220;
const SKINS = ['abe_01.png', 'abe_02.png'];

type Screen = 'menu' | 'game';
type Direction = 'left' | 'right';
type GamePhase = 'playing' | 'over';
type PlatformKind = 'wood' | 'moving' | 'cloud' | 'stone' | 'spring';
type MovingAxis = 'horizontal' | 'vertical';

interface Platform {
  id: number;
  kind: PlatformKind;
  axis?: MovingAxis;
  x: number;
  y: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
  range: number;
  phase: number;
  speed: number;
  broken: boolean;
}

interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
}

interface GameState {
  player: Player;
  platforms: Platform[];
  cameraY: number;
  score: number;
  phase: GamePhase;
  nextPlatformId: number;
  cycleIndex: number;
  lastGeneratedX: number;
}

interface ControlState {
  left: boolean;
  right: boolean;
}

interface PatternEntry {
  kind: PlatformKind;
  axis?: MovingAxis;
}

const PLATFORM_PATTERN: PatternEntry[] = [
  { kind: 'wood' },
  { kind: 'moving', axis: 'horizontal' },
  { kind: 'cloud' },
  { kind: 'wood' },
  { kind: 'moving', axis: 'vertical' },
  { kind: 'stone' },
  { kind: 'spring' },
];

function ArrowIcon({ direction }: { direction: Direction }) {
  const rotation = direction === 'left' ? 180 : 0;

  return (
    <svg
      className="arrow-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path
        d="M5 12h12m-5-5 5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getPlatformSize(kind: PlatformKind) {
  switch (kind) {
    case 'cloud':
      return { width: 108, height: 18 };
    case 'stone':
      return { width: 110, height: 20 };
    case 'spring':
      return { width: 90, height: 22 };
    default:
      return { width: 96, height: 18 };
  }
}

function createPlatform(
  id: number,
  kind: PlatformKind,
  x: number,
  y: number,
  axis?: MovingAxis,
): Platform {
  const { width, height } = getPlatformSize(kind);
  const speed = kind === 'moving' ? (axis === 'horizontal' ? 0.05 : 0.04) : 0;
  const range = kind === 'moving' ? (axis === 'horizontal' ? 64 : 52) : 0;

  return {
    id,
    kind,
    axis,
    x,
    y,
    width,
    height,
    originX: x,
    originY: y,
    range,
    phase: Math.random() * Math.PI * 2,
    speed,
    broken: false,
  };
}

function generatePlatforms(
  platforms: Platform[],
  cameraY: number,
  nextPlatformId: number,
  cycleIndex: number,
  lastGeneratedX: number,
) {
  let topMostY = Math.min(...platforms.map((platform) => platform.y));
  let id = nextPlatformId;
  let patternIndex = cycleIndex;
  let previousX = lastGeneratedX;

  while (topMostY > cameraY - PLATFORM_BUFFER) {
    const pattern = PLATFORM_PATTERN[patternIndex];
    const gap =
      pattern.kind === 'spring'
        ? 106 + Math.random() * 14
        : 88 + Math.random() * 18;
    const nextY = topMostY - gap;
    const { width } = getPlatformSize(pattern.kind);
    const minX = 16;
    const maxX = VIEW_WIDTH - width - 16;
    const preferredDistance = 74;
    let nextX = clamp(previousX + (Math.random() > 0.5 ? 1 : -1) * preferredDistance, minX, maxX);
    let bestDistance = Math.abs(nextX - previousX);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidateX = minX + Math.random() * (maxX - minX);
      const candidateDistance = Math.abs(candidateX - previousX);

      if (candidateDistance > bestDistance) {
        nextX = candidateX;
        bestDistance = candidateDistance;
      }
    }

    if (bestDistance < 56) {
      const pushDirection = previousX < VIEW_WIDTH / 2 ? 1 : -1;
      nextX = clamp(previousX + pushDirection * (72 + Math.random() * 52), minX, maxX);
    }

    platforms.push(createPlatform(id, pattern.kind, nextX, nextY, pattern.axis));

    topMostY = nextY;
    previousX = nextX;
    id += 1;
    patternIndex = (patternIndex + 1) % PLATFORM_PATTERN.length;
  }

  return {
    platforms,
    nextPlatformId: id,
    cycleIndex: patternIndex,
    lastGeneratedX: previousX,
  };
}

function createInitialGame(): GameState {
  const basePlatforms = [createPlatform(1, 'wood', START_PLATFORM_X, START_PLATFORM_Y)];
  const generated = generatePlatforms(basePlatforms, 0, 2, 0, START_PLATFORM_X);

  return {
    player: {
      x: START_PLAYER_X,
      y: START_PLAYER_Y,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      vx: 0,
      vy: 0,
    },
    platforms: generated.platforms,
    cameraY: 0,
    score: 0,
    phase: 'playing',
    nextPlatformId: generated.nextPlatformId,
    cycleIndex: generated.cycleIndex,
    lastGeneratedX: generated.lastGeneratedX,
  };
}

function advanceGame(state: GameState, controls: ControlState, delta: number): GameState {
  const player = { ...state.player };

  let platforms = state.platforms.map((platform) => {
    if (platform.kind !== 'moving') {
      return platform;
    }

    const phase = platform.phase + platform.speed * delta;
    const nextPlatform = { ...platform, phase };

    if (platform.axis === 'horizontal') {
      nextPlatform.x = clamp(
        nextPlatform.originX + Math.sin(phase) * nextPlatform.range,
        12,
        VIEW_WIDTH - nextPlatform.width - 12,
      );
    } else {
      nextPlatform.y = nextPlatform.originY + Math.sin(phase) * nextPlatform.range;
    }

    return nextPlatform;
  });

  if (controls.left) {
    player.vx -= MOVE_ACCEL * delta;
  }

  if (controls.right) {
    player.vx += MOVE_ACCEL * delta;
  }

  if (!controls.left && !controls.right) {
    player.vx *= Math.pow(0.9, delta);
  }

  player.vx = clamp(player.vx, -MAX_SPEED_X, MAX_SPEED_X);
  player.x = clamp(player.x + player.vx * delta, 0, VIEW_WIDTH - player.width);

  const previousY = player.y;
  player.vy = Math.min(MAX_FALL_SPEED, player.vy + GRAVITY * delta);
  player.y += player.vy * delta;

  if (player.vy > 0) {
    const previousBottom = previousY + player.height;
    const nextBottom = player.y + player.height;

    const landingPlatform = [...platforms]
      .sort((left, right) => left.y - right.y)
      .find((platform) => {
        if (platform.broken) {
          return false;
        }

        const horizontalOverlap =
          player.x + player.width - 8 > platform.x &&
          player.x + 8 < platform.x + platform.width;
        const crossedFromAbove =
          previousBottom <= platform.y + platform.height &&
          nextBottom >= platform.y;

        return horizontalOverlap && crossedFromAbove;
      });

    if (landingPlatform) {
      player.y = landingPlatform.y - player.height;
      player.vy =
        landingPlatform.kind === 'spring'
          ? SUPER_JUMP_VELOCITY
          : JUMP_VELOCITY;

      if (landingPlatform.kind === 'cloud' || landingPlatform.kind === 'stone') {
        platforms = platforms.filter((platform) => platform.id !== landingPlatform.id);
      }
    }
  }

  const nextCameraY = Math.min(state.cameraY, player.y - VIEW_HEIGHT * 0.58);

  platforms = platforms.filter(
    (platform) =>
      !platform.broken && platform.y < nextCameraY + VIEW_HEIGHT + PLATFORM_PRUNE_MARGIN,
  );

  const generated = generatePlatforms(
    platforms,
    nextCameraY,
    state.nextPlatformId,
    state.cycleIndex,
    state.lastGeneratedX,
  );

  const score = Math.max(
    state.score,
    Math.max(0, Math.round((START_PLAYER_Y - player.y) * 0.45)),
  );

  const playerTopInView = player.y - nextCameraY;
  const playerBottomInView = playerTopInView + player.height;
  const playerRightInView = player.x + player.width;
  const isPlayerOutsideView =
    playerRightInView <= 0 ||
    player.x >= VIEW_WIDTH ||
    playerBottomInView <= 0 ||
    playerTopInView >= VIEW_HEIGHT;

  const phase: GamePhase = isPlayerOutsideView ? 'over' : state.phase;

  return {
    player,
    platforms: generated.platforms,
    cameraY: nextCameraY,
    score,
    phase,
    nextPlatformId: generated.nextPlatformId,
    cycleIndex: generated.cycleIndex,
    lastGeneratedX: generated.lastGeneratedX,
  };
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [selectedSkin, setSelectedSkin] = useState(SKINS[0]);
  const [showSkinSelector, setShowSkinSelector] = useState(false);
  const [screen, setScreen] = useState<Screen>('menu');
  const [game, setGame] = useState<GameState>(() => createInitialGame());
  const [controls, setControls] = useState<ControlState>({ left: false, right: false });
  const controlsRef = useRef<ControlState>({ left: false, right: false });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSplash(false);
    }, 700);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        controlsRef.current.left = true;
        setControls((previous) => (previous.left ? previous : { ...previous, left: true }));
      }

      if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        controlsRef.current.right = true;
        setControls((previous) => (previous.right ? previous : { ...previous, right: true }));
      }

      if (event.key === 'r' || event.key === 'R') {
        setGame(createInitialGame());
      }

      if (event.key === 'Escape') {
        setScreen('menu');
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        controlsRef.current.left = false;
        setControls((previous) => (previous.left ? { ...previous, left: false } : previous));
      }

      if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        controlsRef.current.right = false;
        setControls((previous) => (previous.right ? { ...previous, right: false } : previous));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (screen !== 'game' || game.phase !== 'playing') {
      return undefined;
    }

    let animationFrame = 0;
    let previousTime = performance.now();

    const loop = (currentTime: number) => {
      const delta = Math.min(2, (currentTime - previousTime) / (1000 / 60));
      previousTime = currentTime;

      setGame((previous) => {
        if (previous.phase !== 'playing') {
          return previous;
        }

        return advanceGame(previous, controlsRef.current, delta);
      });

      animationFrame = window.requestAnimationFrame(loop);
    };

    animationFrame = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [game.phase, screen]);

  const visiblePlatforms = game.platforms.filter((platform) => {
    const top = platform.y - game.cameraY;
    return top > -80 && top < VIEW_HEIGHT + 120;
  });

  const playerTop = game.player.y - game.cameraY;

  const setDirection = (direction: Direction, pressed: boolean) => {
    controlsRef.current = {
      ...controlsRef.current,
      [direction]: pressed,
    };
    setControls((previous) => ({ ...previous, [direction]: pressed }));
  };

  const handleControlPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    direction: Direction,
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDirection(direction, true);
  };

  const handleControlPointerUp = (
    event: ReactPointerEvent<HTMLButtonElement>,
    direction: Direction,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDirection(direction, false);
  };

  const startGame = () => {
    controlsRef.current = { left: false, right: false };
    setControls({ left: false, right: false });
    setGame(createInitialGame());
    setScreen('game');
  };

  const backToMenu = () => {
    controlsRef.current = { left: false, right: false };
    setControls({ left: false, right: false });
    setScreen('menu');
  };

  return (
    <div className={`app-shell ${showSplash ? 'splash-active' : ''}`}>
      {showSplash && (
        <div className="splash-screen">
          <h1>ディミントー</h1>
        </div>
      )}

      {screen === 'menu' ? (
        <div className="menu-screen">
          <header className="menu-header">
            <h1>あべぴょん</h1>
          </header>

          <main className="menu-main">
            <div className="skin-panel compact">
              <div className="skin-display">
                <img src={`/${selectedSkin}`} alt="Selected Abe-pyon" />
              </div>
            </div>

            {showSkinSelector ? (
              <div className="skin-selector">
                {SKINS.map((skin) => (
                  <button
                    key={skin}
                    type="button"
                    className={`skin-btn ${selectedSkin === skin ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedSkin(skin);
                      setShowSkinSelector(false);
                    }}
                  >
                    <img src={`/${skin}`} alt={skin} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="menu-buttons">
                <button type="button" onClick={startGame}>
                  スタート
                </button>
                <button type="button" className="secondary" onClick={() => setShowSkinSelector(true)}>
                  スキン
                </button>
              </div>
            )}

          </main>

          <footer className="menu-footer">
            <a
              href="https://www.jimin.jp/"
              target="_blank"
              rel="noreferrer"
              aria-label="自由民主党のサイトを開く"
            >
              <img src="/ad.png" alt="Advertisement" className="banner-ad" />
            </a>
          </footer>
        </div>
      ) : (
        <div className="game-screen">
          <div className="game-wrapper solo">
            <div className="game-view">
              <div className="game-stage" style={{ width: VIEW_WIDTH, height: VIEW_HEIGHT }}>
                <div className="hud floating">
                  <span>Score {game.score}</span>
                </div>

                {visiblePlatforms.map((platform) => (
                  <div
                    key={platform.id}
                    className={`platform ${platform.kind} ${
                      platform.axis ? `axis-${platform.axis}` : ''
                    }`}
                    style={{
                      width: platform.width,
                      height: platform.height,
                      transform: `translate3d(${platform.x}px, ${platform.y - game.cameraY}px, 0)`,
                    }}
                  />
                ))}

                <img
                  className="player"
                  src={`/${selectedSkin}`}
                  alt="Abe-pyon"
                  style={{
                    width: game.player.width,
                    height: game.player.height,
                    transform: `translate3d(${game.player.x}px, ${playerTop}px, 0)`,
                  }}
                />

                <div className="controls overlay">
                  <button
                    type="button"
                    className={controls.left ? 'active' : ''}
                    onPointerDown={(event) => handleControlPointerDown(event, 'left')}
                    onPointerUp={(event) => handleControlPointerUp(event, 'left')}
                    onPointerCancel={(event) => handleControlPointerUp(event, 'left')}
                  >
                    <ArrowIcon direction="left" />
                  </button>
                  <button
                    type="button"
                    className={controls.right ? 'active' : ''}
                    onPointerDown={(event) => handleControlPointerDown(event, 'right')}
                    onPointerUp={(event) => handleControlPointerUp(event, 'right')}
                    onPointerCancel={(event) => handleControlPointerUp(event, 'right')}
                  >
                    <ArrowIcon direction="right" />
                  </button>
              </div>

                {game.phase === 'over' && (
                  <div className="overlay-card">
                    <h2>ゲームオーバー</h2>
                    <p>スコア: {game.score}</p>
                    <div className="overlay-actions">
                      <button type="button" onClick={() => setGame(createInitialGame())}>
                        もう一回
                      </button>
                      <button type="button" className="secondary" onClick={backToMenu}>
                        メニューへ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
