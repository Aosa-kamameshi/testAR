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
let isCubeVisible = false;
let motionSensorEnabled = false;
let isAppStarted = false;

// モーションセンサーがサポートされているか確認
const isMotionSupported = window.DeviceOrientationEvent || window.DeviceMotionEvent;

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
      }
      
      if (motionPermission !== 'granted') {
        console.warn("モーションセンサーの使用が許可されていません");
        return false;
      }
      return true;
    }
    // 許可リクエストが不要なブラウザの場合はtrueを返す
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

// カメラアクセスの許可をリクエストする関数
async function requestCameraPermission(preferFront = false) {
  try {
    // 現在のストリームを停止
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }
    
    showMessage("カメラへのアクセスを許可してください");
    
    const facingMode = preferFront ? "user" : { exact: "environment" };
    
    try {
      // モバイルデバイスではビデオの制約を追加
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: facingMode,
          width: { ideal: window.innerWidth },
          height: { ideal: window.innerHeight }
        }
      });
      
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
      
      const alternativeStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: alternativeFacingMode,
          width: { ideal: window.innerWidth },
          height: { ideal: window.innerHeight }
        }
      });
      
      return { stream: alternativeStream, isFrontCamera: !preferFront };
    }
  } catch (err) {
    console.error("カメラアクセスエラー:", err);
    throw new Error("カメラへのアクセスができません");
  }
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
    
    showMessage(`${isFrontCamera ? '前面' : '背面'}カメラに切り替えました`);
    showLoading(false);
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

// 3Dオブジェクトの位置をリセットする関数
function resetObjectPosition() {
  arObject.setAttribute('position', {x: 0, y: 1, z: -3});
  arObject.setAttribute('rotation', {x: 0, y: 45, z: 0});
  showMessage("位置をリセットしました");
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
    
    // キューブが表示されていなければ自動的に表示する
    if (!isCubeVisible) {
      toggleCube();
    }
  } else {
    showMessage('モーションセンサーを有効にできませんでした');
  }
  
  showLoading(false);
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
          resolve();
        }).catch(error => {
          console.error("ビデオ再生エラー:", error);
          // エラーが発生しても進める
          video.style.display = 'block';
          resolve();
        });
      };
    });
    
    // ARコンテナの表示
    arContainer.style.display = 'block';
    
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
    
    // モーションセンサーボタンの表示条件
    if (isMotionSupported) {
      if (typeof DeviceMotionEvent !== 'undefined' && 
          typeof DeviceMotionEvent.requestPermission === 'function') {
        enableMotionButton.style.display = 'block';
      } else {
        // 許可が不要なブラウザでは自動的にモーションセンサーを有効化
        motionSensorEnabled = true;
        window.addEventListener('deviceorientation', handleDeviceOrientation);
      }
    }
    
    showLoading(false);
    
    // アプリ開始時に自動的にキューブを表示（オプション）
    // setTimeout(() => toggleCube(), 1000);
    
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
  if (!isCubeVisible) {
    toggleCube();
  }
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

// 画面の向きが変わったときにビデオサイズを調整
window.addEventListener('resize', () => {
  // ビデオサイズを画面サイズに合わせる
  if (video.style.display !== 'none' && currentStream) {
    // 現在のストリームのトラックを取得
    const videoTrack = currentStream.getVideoTracks()[0];
    if (videoTrack) {
      // 必要に応じて制約を更新
      const constraints = {
        width: { ideal: window.innerWidth },
        height: { ideal: window.innerHeight }
      };
      
      videoTrack.applyConstraints(constraints).catch(err => {
        console.warn("リサイズ制約適用エラー:", err);
      });
    }
  }
});

// A-Frame のロードが完了したことを確認
document.addEventListener('DOMContentLoaded', () => {
  // ARコンテナの表示を一旦非表示にする
  arContainer.style.display = 'none';
  
  // A-Frame のシーンが読み込まれたら追加の初期化
  const scene = document.querySelector('a-scene');
  if (scene.hasLoaded) {
    console.log('A-Frameシーンがすでに読み込まれています');
  } else {
    scene.addEventListener('loaded', function () {
      console.log('A-Frameシーンが読み込まれました');
    });
  }
  
  // 最初のカラーオプションをアクティブに
  colorOptions[0].classList.add('active');
});

// シングルタップでもARオブジェクトを表示するための追加リスナー
document.addEventListener('click', () => {
  if (isAppStarted && !isCubeVisible) {
    // アプリが起動済みで、キューブが非表示の場合にタップで表示
    // toggleCube();
  }
});
