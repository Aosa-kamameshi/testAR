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
let isCubeVisible = true; // キューブを表示するように設定
let motionSensorEnabled = false;
let isAppStarted = false;
let videoTrack = null;

// --- 修正済み再帰制御フラグ ---
let visibilityCheckScheduled = false;

// モーションセンサーがサポートされているか確認
const isMotionSupported = window.DeviceOrientationEvent || window.DeviceMotionEvent;

// A-Frameシーンへの参照を保持
let aframeScene = null;

// --- 修正済み箇所 ---
function checkCubeVisibility() {
    if (isAppStarted && isCubeVisible) {
      const actualVisibility = arObject.getAttribute('visible');
      if (actualVisibility === false || actualVisibility === 'false') {
        console.log("キューブが非表示になっているので再表示します");
        ensureCubeVisible();
      }
    }
  
    if (!visibilityCheckScheduled) {
      visibilityCheckScheduled = true;
      setTimeout(() => {
        visibilityCheckScheduled = false; // スケジュールをリセット
        requestAnimationFrame(checkCubeVisibility);
      }, 1000); // 1秒ごとにチェック
    }
  }
  

// モーションセンサーの許可をリクエストする関数
async function requestMotionPermission() {
  try {
    // iOS 13+でのモーションセンサー許可リクエスト
    if (typeof DeviceMotionEvent !== 'undefined' && 
        typeof DeviceMotionEvent.requestPermission === 'function') {
      
      const motionPermission = await DeviceMotionEvent.requestPermission();
      
      // 方向センサーも許可リクエスト
      if (typeof DeviceOrientationEvent !== 'undefined' && 
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const orientationPermission = await DeviceOrientationEvent.requestPermission();
        
        if (orientationPermission !== 'granted') {
          console.warn("方向センサーの使用が許可されていません");
          return false;
        }
      }
      
      if (motionPermission !== 'granted') {
        console.warn("モーションセンサーの使用が許可されていません");
        return false;
      }
      
      return true;
    } 
    
    // Android またはその他のブラウザでは自動的に権限をリクエスト
    if (window.DeviceOrientationEvent) {
      // テスト用のリスナーを追加して権限状況を確認
      const tempListener = (event) => {
        window.removeEventListener('deviceorientation', tempListener);
        // 実際にデータを受け取れるかどうかで権限を推測
        return (event && (event.alpha !== null || event.beta !== null || event.gamma !== null));
      };
      
      window.addEventListener('deviceorientation', tempListener, { once: true });
      
      // 一時的なタイムアウトで権限チェック (推測的手法)
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 許可リクエストが不要なブラウザの場合はtrueを返す
      return true;
    }
    
    return true;
  } catch (err) {
    console.error("センサーアクセスエラー:", err);
    showMessage("モーションセンサーへのアクセスに失敗しました");
    return false;
  }
}

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
  const videoWidth = settings.width;
  const videoHeight = settings.height;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  
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
    
    // ビデオ要素に新しいストリームを設定
    video.srcObject = stream;
    currentStream = stream;
    isFrontCamera = newIsFrontCamera;
    
    // 前面カメラの場合はミラーリングを適用
    video.classList.toggle('mirror-mode', isFrontCamera);
    
    // カメラのサイズを調整
    videoTrack = stream.getVideoTracks()[0];
    adjustVideoSize();
    
    showMessage(`${isFrontCamera ? '前面' : '背面'}カメラに切り替えました`);
    showLoading(false);
    
    // カメラ切り替え後にキューブの位置をリセット
    resetObjectPosition();
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
  if (!isCubeVisible) {
    toggleCube(); // キューブが非表示なら表示に切り替え
  }
  
  // A-Frame要素の可視性を確認
  const actualVisibility = arObject.getAttribute('visible');
  if (actualVisibility === false || actualVisibility === 'false') {
    console.log("キューブが非表示状態なので強制的に表示します");
    arObject.setAttribute('visible', true);
    isCubeVisible = true;
    
    // アイコンの更新
    const icon = toggleCubeBtn.querySelector('i');
    icon.classList.remove('fa-cube');
    icon.classList.add('fa-eye-slash');
  }
  
  // キューブの位置とスケールを確認して調整
  const position = arObject.getAttribute('position');
  if (!position || (position.x === 0 && position.y === 0 && position.z === 0)) {
    resetObjectPosition();
  }
  
  // キューブのスケールを確認
  const scale = arObject.getAttribute('scale');
  if (!scale || scale.x < 0.3 || scale.y < 0.3 || scale.z < 0.3) {
    arObject.setAttribute('scale', '0.5 0.5 0.5');
  }
  
  // マテリアルを確実に設定
  const material = arObject.getAttribute('material');
  if (!material || !material.color) {
    arObject.setAttribute('material', 'color: #2196F3; metalness: 0.2; roughness: 0.8;');
  }
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
    // カメラのlook-controlsを無効に設定
    camera.setAttribute('look-controls', 'enabled', false);
  }
  
  // ARコンテナのサイズをウィンドウサイズに合わせる
  arContainer.style.width = '100vw';
  arContainer.style.height = '100vh';
  
  // キューブの初期設定
  ensureCubeVisible();
}

// --- アプリ起動時の関数 ---
async function startApp() {
    if (isAppStarted) return;
  
    showLoading(true);
  
    try {
      const { stream, isFrontCamera: newIsFrontCamera } = await requestCameraPermission(false);
      currentStream = stream;
      isFrontCamera = newIsFrontCamera;
      video.srcObject = stream;
      video.classList.toggle('mirror-mode', isFrontCamera);
  
      await new Promise(resolve => {
        video.onloadedmetadata = () => {
          video.play().then(() => {
            video.style.display = 'block';
            adjustVideoSize();
            resolve();
          }).catch(error => {
            console.error("ビデオ再生エラー:", error);
            video.style.display = 'block';
            resolve();
          });
        };
      });
  
      initAframeScene();
      arContainer.style.display = 'block';
  
      if (isFrontCamera) {
        showMessage('前面カメラを使用しています');
      } else {
        showMessage('背面カメラを使用しています');
      }
  
      startScreen.style.display = 'none';
      controlPanel.style.display = 'block';
      isAppStarted = true;
  
      ensureCubeVisible();
      const icon = toggleCubeBtn.querySelector('i');
      icon.classList.remove('fa-cube');
      icon.classList.add('fa-eye-slash');
  
      if (isMotionSupported) {
        if (typeof DeviceMotionEvent !== 'undefined' && 
            typeof DeviceMotionEvent.requestPermission === 'function') {
          enableMotionButton.style.display = 'block';
        } else {
          enableMotionButton.style.display = 'block';
        }
      } else {
        enableMotionButton.style.display = 'none';
        showMessage("このデバイスではモーションセンサーがサポートされていません");
      }
  
      showLoading(false);
  
      // --- 修正済み関数を呼び出し ---
      checkCubeVisibility();
  
    } catch (err) {
      console.error("アプリ起動エラー:", err);
      showLoading(false);
      showMessage("アプリの起動に失敗しました: " + err.message);
    }
}

// キューブの表示状態を定期的に確認する関数
function checkCubeVisibility() {
  if (isAppStarted && isCubeVisible) {
    // A-Frameでの実際の表示状態を確認
    const actualVisibility = arObject.getAttribute('visible');
    if (actualVisibility === false || actualVisibility === 'false') {
      console.log("キューブが非表示になっているので再表示します");
      ensureCubeVisible();
    }
  }
  
  // 毎秒チェック
  setTimeout(() => {
    requestAnimationFrame(checkCubeVisibility);
  }, 1000);
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

// ウィンドウのリサイズ時にビデオとARの調整
window.addEventListener('resize', () => {
  // アプリが開始されている場合のみ調整
  if (isAppStarted && videoTrack) {
    // ビデオサイズを画面サイズに合わせる
    setTimeout(() => {
      adjustVideoSize();
      
      // 画面サイズが変わったらキューブの位置をリセット
      resetObjectPosition();
    }, 300);
  }
});

// デバイスの向き変更イベント
window.addEventListener('orientationchange', () => {
  if (isAppStarted && videoTrack) {
    setTimeout(() => {
      adjustVideoSize();
      resetObjectPosition();
    }, 500); // 向き変更後に少し待って調整
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

// --- 画面サイズ取得とシーン調整関数 ---
function adjustSceneSizeAndPosition() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
  
    // a-scene のサイズを調整
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.style.width = `${screenWidth}px`;
      scene.style.height = `${screenHeight}px`;
    }
  
    // キューブの位置を画面の中央に設定
    const cube = document.getElementById('arObject');
    if (cube) {
      const centerX = 0; // 中心 X 座標 (A-Frame は -3 ~ 3 の範囲)
      const centerY = 1; // 中心 Y 座標 (1 は高さの目安)
      const centerZ = -3; // 中心 Z 座標 (カメラからの距離)
  
      cube.setAttribute('position', { x: centerX, y: centerY, z: centerZ });
      console.log("キューブを画面中央に配置しました:", { x: centerX, y: centerY, z: centerZ });
    }
  }
  
  // --- ウィンドウサイズ変更時に再調整 ---
  window.addEventListener('resize', adjustSceneSizeAndPosition);
  
  // --- アプリ起動時にシーンサイズとキューブ位置を調整 ---
  document.addEventListener('DOMContentLoaded', () => {
    adjustSceneSizeAndPosition();
  });
