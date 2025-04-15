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
  
    const scene = document.querySelector('a-scene');
    const canvas = document.querySelector('canvas.a-canvas');
  
    if (scene) {
      scene.style.width = `${screenWidth}px`;
      scene.style.height = `${screenHeight}px`;
    }
    if (canvas) {
      canvas.style.width = `${screenWidth}px`;
      canvas.style.height = `${screenHeight}px`;
    }
}
  
function initAR() {
    aframeScene = document.querySelector('a-scene');
    if (!aframeScene) {
      console.error("A-Frameシーンが見つかりません");
      return;
    }
    
    // モバイル環境の検出と最適化
    optimizeForMobile();
    
    // Safariの場合は特別な修正を適用
    fixSafariARDisplay();
    
    // シーンがロードされたらサイズ調整とキューブの配置
    aframeScene.addEventListener('loaded', () => {
      console.log("A-Frameシーンがロードされました");
      adjustSceneSize();
      centerCube();
      ensureCubeVisible(); // キューブの表示を確実にする
      
      // Safari特有の問題修正を遅延実行
      if (isSafari()) {
        setTimeout(forceShowCube, 500);
      }
    });
    
    // すでにロード済みの場合も処理を実行
    if (aframeScene.hasLoaded) {
      console.log("A-Frameシーンは既にロード済み");
      adjustSceneSize();
      centerCube();
      ensureCubeVisible();
    }
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
  
// 無限ループ解消：キューブの表示状態を確認
let cubeVisibilityCheckHandle = null;

function startCubeVisibilityCheck() {
  if (cubeVisibilityCheckHandle) return; // 既に監視中の場合は何もしない

  const checkVisibility = () => {
    if (isAppStarted && isCubeVisible) {
      const actualVisibility = arObject.getAttribute('visible');
      if (actualVisibility === false || actualVisibility === 'false') {
        ensureCubeVisible(); // キューブが非表示なら再表示
      }
    }
    cubeVisibilityCheckHandle = requestAnimationFrame(checkVisibility);
  };
  cubeVisibilityCheckHandle = requestAnimationFrame(checkVisibility);
}

function adjustSceneForSafari() {
  if (isSafari()) {
    const canvas = document.querySelector('canvas.a-canvas');
    if (canvas) {
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }
  }
}

// アプリ起動時にキューブ表示チェックを開始
async function startApp() {
    if (isAppStarted) return;
    
    showLoading(true);
    
    try {
      // カメラアクセスを取得
      const { stream, isFrontCamera: newIsFrontCamera } = await requestCameraPermission(false);
      currentStream = stream;
      isFrontCamera = newIsFrontCamera;
      
      // ビデオ要素の設定
      video.srcObject = stream;
      video.classList.toggle('mirror-mode', isFrontCamera);
      
      // ビデオのメタデータがロードされたらサイズ調整と再生
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play()
            .then(() => {
              video.style.display = 'block';
              adjustVideoSize();
              resolve();
            })
            .catch(err => {
              console.warn("ビデオ再生の自動開始に失敗しました:", err);
              // Safariではユーザーインタラクションが必要な場合がある
              video.style.display = 'block';
              resolve();
            });
        };
        
        // 念のためタイムアウト設定
        setTimeout(resolve, 3000);
      });
      
      // A-Frameの初期化とARコンテナ表示
      initAR();
      arContainer.style.display = 'block';
      
      // UI表示の更新
      startScreen.style.display = 'none';
      controlPanel.style.display = 'block';
      isAppStarted = true;
      
      // キューブを確実に表示
      setTimeout(() => {
        ensureCubeVisible();
        forceShowCube(); // 強制表示を追加
      }, 300);
      
      showMessage("アプリを開始しました");
      showLoading(false);
      
      // Safari特有の問題に対する追加修正
      if (isSafari()) {
        setTimeout(fixSafariARDisplay, 500);
        setTimeout(forceShowCube, 1000);
      }
      
      // 表示監視の開始
      startCubeVisibilityCheck();
      
    } catch (err) {
      console.error("アプリ起動エラー:", err);
      showMessage("アプリの起動に失敗しました: " + err.message);
      showLoading(false);
    }
}

// --- アプリ終了時のリソース解放処理を追加 ---
function stopApp() {
    stopCubeVisibilityCheck();
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    isAppStarted = false;
}
  
window.addEventListener('beforeunload', stopApp); // ページ終了時にリソース解放
  
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
function ensureCubeVisible() {
    // キューブが表示状態でなければ状態を更新
    if (!isCubeVisible) {
      isCubeVisible = true;
      
      // UIのアイコン更新
      const icon = toggleCubeBtn.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-cube');
        icon.classList.add('fa-eye-slash');
      }
    }
    
    // A-Frameのキューブ要素
    const cube = document.getElementById('arObject');
    if (!cube) {
      console.error("キューブ要素が見つかりません");
      return;
    }
    
    // キューブの表示を複数の方法で強制
    cube.setAttribute('visible', true);
    cube.object3D.visible = true; // Three.js オブジェクト直接操作
    
    // 明示的にスタイルを設定
    cube.style.visibility = 'visible';
    cube.style.display = 'block';
    cube.style.opacity = '1';
    
    // キューブの位置をリセット（念のため）
    resetObjectPosition();
    
    // Safari用の特別な修正
    if (isSafari()) {
      forceShowCube();
    }
    
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
  
    // キューブ表示監視の停止
    stopCubeVisibilityCheck();
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

// Safari環境判定関数
function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }
  
  // DOMロード後の初期化
  document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMがロードされました - Safari対応とキューブ監視を初期化");
  
    adjustSceneForSafari(); // Safari対応のサイズ調整
    startCubeVisibilityCheck(); // キューブ表示監視を開始
  });

  // Safari特有の問題に対応するための追加関数
function fixSafariARDisplay() {
    if (isSafari()) {
      console.log("Safari環境を検出 - 特別な表示修正を適用");
      
      // Safariでのスケーリング問題を修正
      document.querySelector('meta[name="viewport"]').setAttribute(
        'content', 
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
      
      // A-Frameのキャンバス要素に直接スタイルを適用
      const canvas = document.querySelector('canvas.a-canvas');
      if (canvas) {
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '3';
        canvas.style.objectFit = 'cover';
      }
      
      // キューブ要素のスタイルを強制
      const cube = document.getElementById('arObject');
      if (cube) {
        // DOMスタイルプロパティを直接適用
        cube.style.visibility = 'visible';
        cube.style.display = 'block';
      }
    }
}
  
// キューブ表示の根本的な問題を修正する強化関数
function forceShowCube() {
    const cube = document.getElementById('arObject');
    if (!cube) return;
    
    // A-Frameのエンティティ属性を直接操作
    cube.setAttribute('visible', 'true');
    
    // イベント発火を明示的に行う
    setTimeout(() => {
      // キューブの位置と回転を明示的に設定
      cube.setAttribute('position', '0 1 -3');
      cube.setAttribute('rotation', '0 45 0');
      cube.setAttribute('scale', '0.5 0.5 0.5');
      
      // マテリアルを再設定
      const currentColor = cube.getAttribute('material').color || '#2196F3';
      cube.setAttribute('material', {
        color: currentColor,
        metalness: 0.2,
        roughness: 0.8
      });
      
      console.log("キューブ表示を強制的に修復しました");
    }, 100);
}
  
// モバイルデバイス用の最適化関数
function optimizeForMobile() {
    // モバイルデバイスかどうかを検出
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      console.log("モバイルデバイスを検出 - 最適化を適用");
      
      // パフォーマンス向上のための調整
      if (aframeScene) {
        // レンダラー設定の最適化
        aframeScene.setAttribute('renderer', {
          antialias: false,  // モバイルではアンチエイリアスを無効化
          precision: 'mediump', // 中程度の精度で十分
          physicallyCorrectLights: false // 物理ベースライティングを無効化
        });
      }
    }
}
