// 要素の取得
const video = document.getElementById('videoBackground');
const startButton = document.getElementById('startButton');
const enableMotionButton = document.getElementById('enableMotionButton');
const startScreen = document.getElementById('startScreen');
const controlPanel = document.getElementById('controlPanel');
const arObject = document.getElementById('arObject');
const statusMessage = document.getElementById('statusMessage');
const loadingIndicator = document.getElementById('loadingIndicator');
const colorSelectBtn = document.getElementById('colorSelectBtn');
const colorPanel = document.getElementById('colorPanel');
const resetPositionBtn = document.getElementById('resetPositionBtn');
const colorOptions = document.querySelectorAll('.color-option');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const arContainer = document.getElementById('arContainer');
const toggleCubeBtn = document.getElementById('toggleCubeBtn');


// カメラの状態を追跡
let currentStream = null;
let isFrontCamera = false;
let hasMultipleCameras = false;
let isCubeVisible = true;
let motionSensorEnabled = false;
let isAppStarted = false;
let videoTrack = null;
let aframeScene = null;

// モーションセンサーがサポートされているか確認
const isMotionSupported = window.DeviceOrientationEvent || window.DeviceMotionEvent;

// --- Safari対応サイズ調整 ---
function adjustSceneSize() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
  
    // a-sceneとcanvasのサイズを調整
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.style.width = `${screenWidth}px`;
      scene.style.height = `${screenHeight}px`;
    }
  
    const canvas = document.querySelector('canvas.a-canvas');
    if (canvas) {
      canvas.style.width = `${screenWidth}px`;
      canvas.style.height = `${screenHeight}px`;
    }
  
    console.log("シーンとキャンバスのサイズを調整:", { screenWidth, screenHeight });
}

function centerCube() {
    const cube = document.getElementById('arObject');
    if (cube) {
      cube.setAttribute('position', { x: 0, y: 1, z: -3 });
      console.log("キューブを画面中央に配置しました");
    } else {
      console.error("キューブが見つかりません");
    }
}

function initAR() {
    aframeScene = document.querySelector('a-scene');
    if (!aframeScene) {
      console.error("A-Frameシーンが見つかりません");
      return;
    }
  
    // シーンがロードされたらサイズ調整とキューブの配置
    aframeScene.addEventListener('loaded', () => {
      console.log("A-Frameシーンがロードされました");
      adjustSceneSize();
      centerCube();
    });
  
    // Safariやモバイルデバイスでの初期化遅延に対応
    adjustSceneSize();
    centerCube();
}

// Safari対応のチェック関数
function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }
  
  // A-Frameシーンのサイズ調整（Safari対応）
  function adjustSceneForSafari() {
    if (isSafari()) {
      console.log("Safari環境のため、A-Frameシーンを調整します");
      const aframeCanvas = document.querySelector('canvas.a-canvas');
      if (aframeCanvas) {
        aframeCanvas.style.position = 'absolute';
        aframeCanvas.style.top = '0';
        aframeCanvas.style.left = '0';
        aframeCanvas.style.width = '100%';
        aframeCanvas.style.height = '100%';
      }
    }
  }
  
  // 無限ループ解消：キューブの表示状態を確認
  let cubeVisibilityCheckInterval = null; // 確認用のインターバルID
  function startCubeVisibilityCheck() {
    if (cubeVisibilityCheckInterval) return; // 二重起動を防止
  
    cubeVisibilityCheckInterval = setInterval(() => {
      if (isAppStarted && isCubeVisible) {
        const actualVisibility = arObject.getAttribute('visible');
        if (actualVisibility === false || actualVisibility === 'false') {
          console.log("キューブが非表示になっているので再表示します");
          ensureCubeVisible();
        }
      }
    }, 1000); // 1秒ごとに確認
  }
  
  function stopCubeVisibilityCheck() {
    if (cubeVisibilityCheckInterval) {
      clearInterval(cubeVisibilityCheckInterval);
      cubeVisibilityCheckInterval = null;
    }
  }
  
  // Safari対応とキューブ表示監視の初期化を統合
  document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMがロードされました - 追加部分の初期化");
    adjustSceneForSafari();
    startCubeVisibilityCheck();
});
  
// モーションセンサーの許可をリクエストする関数
// スタートボタンイベントの改善
async function startApp() {
    if (isAppStarted) return;
  
    showLoading(true);
  
    try {
      const { stream, isFrontCamera: newIsFrontCamera } = await requestCameraPermission(false);
      currentStream = stream;
      isFrontCamera = newIsFrontCamera;
      video.srcObject = stream;
      video.classList.toggle('mirror-mode', isFrontCamera);
  
      video.onloadedmetadata = () => {
        video.play().then(() => {
          video.style.display = 'block';
          adjustSceneSize();
        });
      };
  
      initAR();
  
      arContainer.style.display = 'block';
      startScreen.style.display = 'none';
      controlPanel.style.display = 'block';
      isAppStarted = true;
  
      showMessage("アプリを開始しました");
      showLoading(false);
    } catch (err) {
      console.error("アプリ起動エラー:", err);
      showMessage("アプリの起動に失敗しました");
      showLoading(false);
    }
}

  // スタートボタンのイベントリスナーを設定
startButton.addEventListener('click', startApp);

// --- サイズ変更時のリアルタイム調整 ---
window.addEventListener('resize', adjustSceneSize);

// --- イベントリスナーの設定 ---
startButton.addEventListener('click', startApp);

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOMがロードされました");
  adjustSceneSize();
  centerCube();
});

// 利用可能なカメラの数を確認する関数
async function checkAvailableCameras() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return false;
  }
  
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    return videoDevices.length > 1;
  } catch (err) {
    console.error("カメラ数の確認に失敗:", err);
    return false;
  }
}

// デバイスの画面サイズに基づいて最適なカメラ解像度を取得
function getOptimalCameraResolution() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // デバイス画面のアスペクト比を計算
  const screenAspectRatio = width / height;
  
  // カメラ解像度の計算 - デバイスに最適化
  let idealWidth, idealHeight;
  
  // モバイルデバイスの場合は適切な解像度を設定
  if (width <= 768) {
    if (screenAspectRatio >= 1) { // 横向き
      idealWidth = Math.min(1280, width);
      idealHeight = Math.floor(idealWidth / screenAspectRatio);
    } else { // 縦向き
      idealHeight = Math.min(1280, height);
      idealWidth = Math.floor(idealHeight * screenAspectRatio);
    }
  } else {
    // デスクトップやタブレットの場合は高解像度を許可
    idealWidth = Math.min(1920, width);
    idealHeight = Math.floor(idealWidth / screenAspectRatio);
  }
  
  return {
    width: { ideal: idealWidth },
    height: { ideal: idealHeight }
  };
}

// カメラアクセスの許可をリクエストする関数
async function requestCameraPermission(preferFront = false) {
  try {
    // 現在のストリームを停止
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }
    
    showMessage("カメラへのアクセスを許可してください");
    
    const facingMode = preferFront ? "user" : { exact: "environment" };
    const resolution = getOptimalCameraResolution();
    
    try {
      // モバイルデバイスではビデオの制約を追加
      const constraints = {
        video: { 
          facingMode: facingMode,
          ...resolution,
          aspectRatio: window.innerWidth / window.innerHeight
        }
      };
      
      console.log("カメラリクエスト制約:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // ビデオトラックを取得
      videoTrack = stream.getVideoTracks()[0];
      console.log("取得したビデオトラック設定:", videoTrack.getSettings());
      
      // 複数カメラがあるか確認
      hasMultipleCameras = await checkAvailableCameras();
      if (hasMultipleCameras) {
        switchCameraBtn.style.display = 'flex';
      }
      
      return { stream, isFrontCamera: preferFront };
    } catch (err) {
      // 一方のカメラが失敗した場合、もう一方を試す
      console.warn(`${preferFront ? '前面' : '背面'}カメラアクセスエラー:`, err);
      const alternativeFacingMode = preferFront ? { exact: "environment" } : "user";
      
      const alternativeConstraints = {
        video: { 
          facingMode: alternativeFacingMode,
          ...resolution,
          aspectRatio: window.innerWidth / window.innerHeight
        }
      };
      
      console.log("代替カメラリクエスト制約:", alternativeConstraints);
      const alternativeStream = await navigator.mediaDevices.getUserMedia(alternativeConstraints);
      
      // ビデオトラックを取得
      videoTrack = alternativeStream.getVideoTracks()[0];
      console.log("代替ビデオトラック設定:", videoTrack.getSettings());
      
      return { stream: alternativeStream, isFrontCamera: !preferFront };
    }
  } catch (err) {
    console.error("カメラアクセスエラー:", err);
    throw new Error("カメラへのアクセスができません");
  }
}

// ビデオ要素のサイズをデバイスに合わせて調整する関数
function adjustVideoSize() {
    if (!videoTrack) return;
    
    const settings = videoTrack.getSettings();
    const videoWidth = settings.width || 640;
    const videoHeight = settings.height || 480;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    console.log(`ビデオ設定: ${videoWidth}x${videoHeight}, 画面: ${screenWidth}x${screenHeight}`);
    
    // スクリーンとビデオのアスペクト比を比較
    const screenAspect = screenWidth / screenHeight;
    const videoAspect = videoWidth / videoHeight;
    
    if (videoAspect > screenAspect) {
      // ビデオの方が横長の場合は、高さに合わせて横をクロップ
      const scale = screenHeight / videoHeight;
      const newWidth = videoWidth * scale;
      const left = (screenWidth - newWidth) / 2;
      
      video.style.width = `${newWidth}px`;
      video.style.height = `${screenHeight}px`;
      video.style.left = `${left}px`;
      video.style.top = '0px';
    } else {
      // ビデオの方が縦長の場合は、幅に合わせて縦をクロップ
      const scale = screenWidth / videoWidth;
      const newHeight = videoHeight * scale;
      const top = (screenHeight - newHeight) / 2;
      
      video.style.width = `${screenWidth}px`;
      video.style.height = `${newHeight}px`;
      video.style.left = '0px';
      video.style.top = `${top}px`;
    }
    
    // A-Frameシーンのサイズも同様に調整
    if (arContainer) {
      arContainer.style.width = '100vw';
      arContainer.style.height = '100vh';
    }
    
    // A-Frameのカメラ位置も調整
    const camera = document.querySelector('a-entity[camera]');
    if (camera) {
      camera.setAttribute('position', '0 1.6 0');
    }
    
    console.log(`ビデオサイズ調整: ${video.style.width} x ${video.style.height}, 位置: ${video.style.left}, ${video.style.top}`);
  }

// メッセージを表示する関数
function showMessage(text, duration = 3000) {
  statusMessage.textContent = text;
  statusMessage.style.display = 'block';
  statusMessage.style.opacity = '1';
  
  // 指定時間後にメッセージをフェードアウト
  if (duration > 0) {
    setTimeout(() => {
      statusMessage.style.opacity = '0';
      setTimeout(() => {
        statusMessage.style.display = 'none';
      }, 300);
    }, duration);
  }
}

// ローディングインジケーターを表示/非表示する関数
function showLoading(show) {
  loadingIndicator.style.display = show ? 'flex' : 'none';
}

// カメラを切り替える関数
async function switchCamera() {
    try {
      showLoading(true);
      const { stream, isFrontCamera: newIsFrontCamera } = await requestCameraPermission(!isFrontCamera);
  
      video.srcObject = stream;
      currentStream = stream;
      isFrontCamera = newIsFrontCamera;
  
      video.classList.toggle('mirror-mode', isFrontCamera);
  
      videoTrack = stream.getVideoTracks()[0];
      adjustVideoSize();
  
      showMessage(`${isFrontCamera ? '前面' : '背面'}カメラに切り替えました`);
      showLoading(false);
  
      resetObjectPosition(); // カメラ切り替え後にリセット
    } catch (err) {
      console.error("カメラ切り替えエラー:", err);
      showMessage("カメラの切り替えに失敗しました");
      showLoading(false);
    }
  }

// キューブの表示/非表示を切り替える関数
function toggleCube() {
  isCubeVisible = !isCubeVisible;
  arObject.setAttribute('visible', isCubeVisible);
  
  // アイコンの更新
  const icon = toggleCubeBtn.querySelector('i');
  if (isCubeVisible) {
    icon.classList.remove('fa-cube');
    icon.classList.add('fa-eye-slash');
    showMessage("キューブを表示しました");
  } else {
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-cube');
    showMessage("キューブを非表示にしました");
  }
}

// キューブを確実に表示する関数
// ensureCubeVisible 関数の改善
function ensureCubeVisible() {
    if (!isCubeVisible) {
      isCubeVisible = true;
  
      // アイコンの更新
      const icon = toggleCubeBtn.querySelector('i');
      icon.classList.remove('fa-cube');
      icon.classList.add('fa-eye-slash');
    }
  
    // キューブの表示を強制的に有効化
    arObject.setAttribute('visible', true);
  
    // キューブの位置とスケールをリセット
    resetObjectPosition();
  
    // DOMスタイルでも強制的に表示
    arObject.style.visibility = 'visible';
    arObject.style.display = 'block';
  
    console.log("キューブの表示を強制的に有効化しました");
  }

// 画面の中央座標を取得する関数
function getScreenCenter() {
  // 画面サイズに基づく調整（視覚的な中央に配置するため）
  // 深さは-3のままで、画面中央に表示されるようにする
  return { x: 0, y: 1, z: -3 };
}

// デバイスの向きに応じて3Dオブジェクトを更新する関数
function handleDeviceOrientation(event) {
  if (!event || !isCubeVisible || !motionSensorEnabled) return;
  
  // デバイスの向きに基づいて3Dオブジェクトの位置を調整
  const tiltLR = event.gamma; // 左右の傾き (-90〜90)
  const tiltFB = event.beta;  // 前後の傾き (-180〜180)
  
  if (tiltLR === null || tiltFB === null) return;
  
  // 箱の位置を更新（制限付き）
  const x = Math.max(-3, Math.min(3, tiltLR / 30));
  const y = Math.max(0, Math.min(3, 1 + tiltFB / 30));
  arObject.setAttribute('position', {x: x, y: y, z: -3});
  
  // キューブを少し回転させてアニメーション効果を加える
  const currentRotation = arObject.getAttribute('rotation');
  arObject.setAttribute('rotation', {
    x: currentRotation.x,
    y: (currentRotation.y + 0.5) % 360,
    z: currentRotation.z
  });
}

// 3Dオブジェクトの位置をリセットする関数（画面中央に配置）
function resetObjectPosition() {
  const centerPosition = getScreenCenter();
  arObject.setAttribute('position', centerPosition);
  arObject.setAttribute('rotation', {x: 0, y: 45, z: 0});
  arObject.setAttribute('scale', '0.5 0.5 0.5');
  showMessage("キューブを画面中央に配置しました");
  
  // キューブが表示されていることを確認
  ensureCubeVisible();
}

// モーションセンサーを有効化する関数
async function enableMotionSensor() {
  showLoading(true);
  const motionGranted = await requestMotionPermission();
  
  if (motionGranted) {
    // モーションセンサーのイベントリスナーを追加
    window.addEventListener('deviceorientation', handleDeviceOrientation);
    motionSensorEnabled = true;
    showMessage('モーションセンサーが有効になりました');
    enableMotionButton.style.display = 'none';
    
    // A-Frameシーンの制御を有効化
    try {
      if (aframeScene) {
        // A-Frameのロードが完了している場合は、look-controlsを有効にする
        const cameraEntity = aframeScene.querySelector('[camera]');
        if (cameraEntity) {
          // look-controlsを有効化せず、完全にカスタムコントロールに任せる
        }
      }
    } catch (err) {
      console.warn("A-Frameシーンの制御設定エラー:", err);
    }
    
    // キューブを表示
    ensureCubeVisible();
  } else {
    showMessage('モーションセンサーを有効にできませんでした');
  }
  
  showLoading(false);
}

// A-Frameシーンの初期化
function initAframeScene() {
    aframeScene = document.querySelector('a-scene');
    if (!aframeScene) {
      console.error("A-Frameシーンが見つかりません");
      return;
    }
  
    // A-Frameシーンの設定
    const camera = aframeScene.querySelector('[camera]');
    if (camera) {
      camera.setAttribute('look-controls', 'enabled', false);
    }
  
    // ARコンテナのサイズをウィンドウサイズに合わせる
    arContainer.style.width = '100vw';
    arContainer.style.height = '100vh';
  
    // Safari対応のサイズ調整
    adjustSceneForSafari();
  
    // キューブの初期設定
    ensureCubeVisible();
}

// アプリを開始する関数
async function startApp() {
  if (isAppStarted) return;
  
  showLoading(true);
  
  try {
    // カメラの許可を取得
    const { stream, isFrontCamera: newIsFrontCamera } = await requestCameraPermission(false);
    
    // グローバル変数を更新
    currentStream = stream;
    isFrontCamera = newIsFrontCamera;
    
    // ビデオ要素に新しいストリームを設定
    video.srcObject = stream;
    
    // 前面カメラの場合はミラーリングを適用
    video.classList.toggle('mirror-mode', isFrontCamera);
    
    await new Promise(resolve => {
      video.onloadedmetadata = () => {
        video.play().then(() => {
          // ビデオが再生されたことを確認して表示
          video.style.display = 'block';
          
          // ビデオサイズを調整
          adjustVideoSize();
          
          resolve();
        }).catch(error => {
          console.error("ビデオ再生エラー:", error);
          // エラーが発生しても進める
          video.style.display = 'block';
          resolve();
        });
      };
    });
    
    // A-Frameシーンの初期化
    initAframeScene();
    
    // ARコンテナの表示
    arContainer.style.display = 'block';
    
    // カメラ情報表示
    if (isFrontCamera) {
      showMessage('前面カメラを使用しています');
    } else {
      showMessage('背面カメラを使用しています');
    }
    
    // UI表示
    startScreen.style.display = 'none';
    controlPanel.style.display = 'block';
    
    // アプリが開始されたことをマーク
    isAppStarted = true;
    
    // キューブを表示
    ensureCubeVisible();
    
    // トグルボタンのアイコンを更新
    const icon = toggleCubeBtn.querySelector('i');
    icon.classList.remove('fa-cube');
    icon.classList.add('fa-eye-slash');
    
    // モーションセンサーボタンの表示条件
    if (isMotionSupported) {
      if (typeof DeviceMotionEvent !== 'undefined' && 
          typeof DeviceMotionEvent.requestPermission === 'function') {
        // iOS 13+の場合は明示的な許可が必要
        enableMotionButton.style.display = 'block';
      } else {
        // 他のブラウザでは自動的にモーションセンサーを有効化を試みる
        enableMotionButton.style.display = 'block';
        
        // Android Chromeなどでは直接試みる
        try {
          // テスト用のリスナーを追加して権限状況を確認
          const tempListener = (event) => {
            window.removeEventListener('deviceorientation', tempListener);
            // 実際にデータを受け取れた場合は自動的に有効化
            if (event && (event.alpha !== null || event.beta !== null || event.gamma !== null)) {
              enableMotionSensor();
            }
          };
          
          window.addEventListener('deviceorientation', tempListener, { once: true });
        } catch (err) {
          console.warn("自動モーションセンサー検出エラー:", err);
        }
      }
    } else {
      enableMotionButton.style.display = 'none';
      showMessage("このデバイスではモーションセンサーがサポートされていません");
    }
    
    showLoading(false);
    
    // キューブを画面中央に配置
    setTimeout(() => resetObjectPosition(), 500);
    
    // アニメーションフレームを開始（キューブ表示確認用）
    requestAnimationFrame(startCubeVisibilityCheck);
    
  } catch (err) {
    console.error("アプリ起動エラー:", err);
    showLoading(false);
    showMessage("アプリの起動に失敗しました: " + err.message);
  }
}

// カラーパネルの表示/非表示を切り替える
function toggleColorPanel() {
  if (colorPanel.style.display === 'block') {
    colorPanel.style.display = 'none';
  } else {
    colorPanel.style.display = 'block';
  }
}

// 3Dオブジェクトの色を変更する
function changeObjectColor(color) {
  arObject.setAttribute('material', 'color', color);
  colorPanel.style.display = 'none';
  
  // アクティブなクラスを更新
  colorOptions.forEach(option => {
    if (option.dataset.color === color) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
  
  // キューブが表示されていなければ表示する
  ensureCubeVisible();
}

// イベントリスナーの設定
startButton.addEventListener('click', startApp);
enableMotionButton.addEventListener('click', enableMotionSensor);
colorSelectBtn.addEventListener('click', toggleColorPanel);
resetPositionBtn.addEventListener('click', resetObjectPosition);
switchCameraBtn.addEventListener('click', switchCamera);
toggleCubeBtn.addEventListener('click', toggleCube);

// カラーオプションのクリックイベント
colorOptions.forEach(option => {
  option.addEventListener('click', () => {
    changeObjectColor(option.dataset.color);
  });
});

let resizeTimeout;
window.addEventListener('resize', () => {
  if (isAppStarted && videoTrack) {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      adjustVideoSize();
      resetObjectPosition();
    }, 300); // 300msの間隔で制御
  }
});

let orientationTimeout;
window.addEventListener('orientationchange', () => {
  if (isAppStarted && videoTrack) {
    clearTimeout(orientationTimeout);
    orientationTimeout = setTimeout(() => {
      adjustVideoSize();
      resetObjectPosition();
    }, 500); // 500msの間隔で制御
  }
});

// A-Frame のロードが完了したことを確認
document.addEventListener('DOMContentLoaded', () => {
  // ARコンテナの表示を一旦非表示にする
  arContainer.style.display = 'none';
  
  // A-Frame のシーンが読み込まれたらシーン参照を保存
  const scene = document.querySelector('a-scene');
  aframeScene = scene;
  
  if (scene.hasLoaded) {
    console.log('A-Frameシーンがすでに読み込まれています');
    initAframeScene();
  } else {
    scene.addEventListener('loaded', function () {
      console.log('A-Frameシーンが読み込まれました');
      initAframeScene();
    });
  }
  
  // 最初のカラーオプションをアクティブに
  colorOptions[0].classList.add('active');
});

// アプリケーションの終了時にリソースを解放
window.addEventListener('beforeunload', () => {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }
  
  // モーションセンサーのリスナーを削除
  if (motionSensorEnabled) {
    window.removeEventListener('deviceorientation', handleDeviceOrientation);
  }
});

// ビデオ要素のサイズをデバイスに合わせて動的に調整する関数
function adjustVideoSize() {
    if (!videoTrack) return;
  
    const settings = videoTrack.getSettings();
    const videoWidth = settings.width || 640;
    const videoHeight = settings.height || 480;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
  
    console.log(`ビデオ設定: ${videoWidth}x${videoHeight}, 画面: ${screenWidth}x${screenHeight}`);
  
    // スクリーンとビデオのアスペクト比を比較
    const screenAspect = screenWidth / screenHeight;
    const videoAspect = videoWidth / videoHeight;
  
    if (videoAspect > screenAspect) {
      // ビデオの方が横長の場合は、高さに合わせて横をクロップ
      const scale = screenHeight / videoHeight;
      const newWidth = videoWidth * scale;
      const left = (screenWidth - newWidth) / 2;
  
      video.style.width = `${newWidth}px`;
      video.style.height = `${screenHeight}px`;
      video.style.left = `${left}px`;
      video.style.top = '0px';
    } else {
      // ビデオの方が縦長の場合は、幅に合わせて縦をクロップ
      const scale = screenWidth / videoWidth;
      const newHeight = videoHeight * scale;
      const top = (screenHeight - newHeight) / 2;
  
      video.style.width = `${screenWidth}px`;
      video.style.height = `${newHeight}px`;
      video.style.left = '0px';
      video.style.top = `${top}px`;
    }
  
    // A-Frameシーンのサイズも同様に調整
    if (arContainer) {
      arContainer.style.width = '100vw';
      arContainer.style.height = '100vh';
    }
  
    console.log(`ビデオサイズ調整完了: ${video.style.width} x ${video.style.height}, 位置: ${video.style.left}, ${video.style.top}`);
  }
