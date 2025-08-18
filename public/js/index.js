document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('kobeVideo');
    const loading = document.getElementById('loading');

    const showLoading = () => {
        loading.classList.add('show');
    };

    const hideLoading = () => {
        loading.classList.remove('show');
    };

    // 视频加载事件
    video.addEventListener('loadstart', showLoading);
    video.addEventListener('canplay', hideLoading);
    video.addEventListener('canplaythrough', hideLoading);
    video.addEventListener('error', hideLoading);

    // 更新进度条
    const updateProgress = (e) => {
        if (e.loaded && e.total) {
            const percent = Math.floor((e.loaded / e.total) * 100);
            const progressBar = document.getElementById('progressBar');
            const progressText = document.getElementById('progressText');

            progressBar.style.width = percent + '%';
            if (progressText) progressText.textContent = percent + '%';
        }
    };

    // 监听缓冲进度
    video.addEventListener('progress', () => {
        if (video.buffered.length > 0 && video.duration) {
            const end = video.buffered.end(0);
            const duration = video.duration;
            const percent = Math.floor((end / duration) * 100);
            updateProgress({ loaded: end, total: duration });
        }
    });

    // 当视频开始播放时，进度条也会自然增长
    // canplay / canplaythrough 触发时隐藏 loading

    const soundButton = document.getElementById('soundButton');
    const tapHint = document.getElementById('tapHint');
    let isPlaying = false;
    let soundOn = false;

    //  tryPlay()
    const tryPlay = async () => {
        if (isPlaying) return;
        try {
            await video.play();
            isPlaying = true;
            tapHint.classList.remove('show');

            // 只有当前是静音状态时，才在首次播放时开启声音
            if (video.muted) {
                video.muted = false;
                soundOn = true;
                soundButton.innerHTML = '🔊';
                soundButton.setAttribute('aria-label', '关闭声音');
            }
            
            // 确保按钮状态与实际播放状态同步
            if (!video.muted && !soundOn) {
                soundOn = true;
                soundButton.innerHTML = '🔊';
                soundButton.setAttribute('aria-label', '关闭声音');
            } else if (video.muted && soundOn) {
                soundOn = false;
                soundButton.innerHTML = '🔇';
                soundButton.setAttribute('aria-label', '开启声音');
            }

        } catch (err) {
            console.warn('自动播放被阻止:', err);
            tapHint.classList.add('show');
        }
    };

    // 页面加载时尝试自动播放
    window.addEventListener('load', tryPlay);

    // 用户任何交互都尝试播放（且只监听一次）
    ['touchstart', 'click', 'scroll', 'keydown'].forEach(event => {
        document.addEventListener(event, tryPlay, { once: true, passive: true });
    });

    // ========== 声音按钮切换 ==========
    soundButton.addEventListener('click', async function () {
        if (!isPlaying) {
            await tryPlay(); // 如果没播放，先尝试播放
        }

        if (!soundOn) {
            video.muted = false;
            soundButton.innerHTML = '🔊';
            soundButton.setAttribute('aria-label', '关闭声音');
            soundOn = true;
        } else {
            video.muted = true;
            soundButton.innerHTML = '🔇';
            soundButton.setAttribute('aria-label', '开启声音');
            soundOn = false;
        }
    });

    //  video click 事件
    video.addEventListener('click', () => {
        if (isPlaying) {
            // 已播放时点击，切换声音
            soundButton.click();
        } else {
            // 未播放时点击，尝试播放
            tryPlay();
            // 确保在播放开始后同步更新声音按钮状态
            if (isPlaying && !soundOn && !video.muted) {
                soundOn = true;
                soundButton.innerHTML = '🔊';
                soundButton.setAttribute('aria-label', '关闭声音');
            }
        }
    });

    // 循环播放
    video.addEventListener('ended', () => {
        video.currentTime = 0;
        video.play().catch(e => console.log('循环播放失败:', e));
    });

    // ========== 小广告逻辑 ==========
    // 使用函数来获取元素，确保每次都能获取到最新的引用
    function getFlyingTributeElements() {
        return {
            flyingTribute: document.getElementById('flyingTribute'),
            closeTribute: document.getElementById('closeTribute')
        };
    }

    let vx = 2; // 水平速度
    let vy = 1.5; // 垂直速度
    let animationId;

    // 初始化位置（避免遮挡按钮）
    function setInitialPosition() {
        const { flyingTribute } = getFlyingTributeElements();
        if (!flyingTribute) {
            console.warn('flyingTribute element not found in setInitialPosition');
            return;
        }
        
        const rect = flyingTribute.getBoundingClientRect();
        let left = Math.random() * (window.innerWidth - rect.width);
        let top = Math.random() * (window.innerHeight - rect.height);

        // 避免覆盖声音按钮（右上角 100x100 区域）
        if (left > window.innerWidth - 100 && top < 100) {
            left = 20;
            top = 20;
        }

        flyingTribute.style.left = `${left}px`;
        flyingTribute.style.top = `${top}px`;
    }

    // 移动 + 碰撞检测
    function moveTribute() {
        const { flyingTribute } = getFlyingTributeElements();
        if (!flyingTribute) {
            console.warn('flyingTribute element not found in moveTribute');
            return;
        }
        
        const rect = flyingTribute.getBoundingClientRect();
        let left = parseFloat(flyingTribute.style.left) || 0;
        let top = parseFloat(flyingTribute.style.top) || 0;

        left += vx;
        top += vy;

        // 右/左边界碰撞
        if (left + rect.width >= window.innerWidth || left <= 0) {
            vx = -vx;
            left = left <= 0 ? 0 : window.innerWidth - rect.width;
        }

        // 下/上边界碰撞
        if (top + rect.height >= window.innerHeight || top <= 0) {
            vy = -vy;
            top = top <= 0 ? 0 : window.innerHeight - rect.height;
        }

        flyingTribute.style.left = `${left}px`;
        flyingTribute.style.top = `${top}px`;

        animationId = requestAnimationFrame(moveTribute);
    }

    // 点击关闭
    function setupCloseButton() {
        const { closeTribute, flyingTribute } = getFlyingTributeElements();
        if (closeTribute && flyingTribute) {
            closeTribute.addEventListener('click', () => {
                console.log('Close button clicked');
                flyingTribute.classList.remove('show');
                console.log('flyingTribute hidden');
                
                setTimeout(() => {
                    if (animationId) {
                        cancelAnimationFrame(animationId);
                        console.log('Animation cancelled');
                    }
                }, 300);
            });
        } else {
            console.warn('closeTribute or flyingTribute element not found. Make sure the DOM elements exist');
        }
    }

    // 页面加载完成后延迟显示
    window.addEventListener('load', () => {
        console.log('Window loaded event triggered');
        
        // 设置关闭按钮事件
        setupCloseButton();
        
        setTimeout(() => {
            const { flyingTribute } = getFlyingTributeElements();
            console.log('flyingTribute element status:', {
                exists: !!flyingTribute,
                classList: flyingTribute ? Array.from(flyingTribute.classList) : null
            });
            
            if (flyingTribute) {
                console.log('Showing flyingTribute after 3s delay');
                setInitialPosition();
                flyingTribute.classList.add('show');
                console.log('flyingTribute displayed');
                moveTribute();
            } else {
                console.error('flyingTribute element not found when trying to show');
            }
        }, 3000); // 3秒后出现，不打扰初始体验
    });

    // 窗口大小改变时重置
    window.addEventListener('resize', () => {
        const { flyingTribute } = getFlyingTributeElements();
        if (flyingTribute && flyingTribute.classList.contains('show')) {
            if (animationId) cancelAnimationFrame(animationId);
            setInitialPosition();
            moveTribute();
        }
    });
    
    // DOM内容加载完成后初始化
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM content loaded');
        // 确保元素引用是最新的
        const { flyingTribute, closeTribute } = getFlyingTributeElements();
        console.log('flyingTribute on DOMContentLoaded:', flyingTribute);
        console.log('closeTribute on DOMContentLoaded:', closeTribute);
        
        // 尝试设置关闭按钮事件
        if (closeTribute && flyingTribute) {
            setupCloseButton();
        }
    });
});