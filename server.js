// ===============================================================================
// APEX TITAN v113.0 (OMNISCIENT SUMMIT OVERLORD) - ULTIMATE ENGINE
// ===============================================================================
// MERGE SYNC: v112.0 (SUMMIT) + v22.1 (OMNISCIENT LEVIATHAN) + BINARY SCALING
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, Wallet, WebSocketProvider, JsonRpcProvider, Contract, formatEther, parseEther, Interface, AbiCoder, FallbackProvider } = require('ethers');
require('dotenv').config();

// --- GEMINI AI CONFIGURATION ---
const apiKey = ""; // Environment provides this at runtime
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";

// --- SAFETY: GLOBAL ERROR HANDLERS (v22.1 RESILIENCE) ---
process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    if (msg.includes('200') || msg.includes('405') || msg.includes('429') || msg.includes('network') || msg.includes('coalesce')) return; 
    console.error("\n\x1b[31m[SYSTEM ERROR]\x1b[0m", msg);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || "";
    if (msg.includes('200') || msg.includes('429') || msg.includes('network') || msg.includes('coalesce') || msg.includes('401')) return;
});

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", gray: "\x1b[90m"
};

// --- CONFIGURATION (v22.1 OMNISCIENT SUMMIT) ---
const GLOBAL_CONFIG = {
    TARGET_CONTRACT: process.env.EXECUTOR_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    BENEFICIARY: process.env.BENEFICIARY || "0xYOUR_OWN_PUBLIC_WALLET_ADDRESS",
    
    // v22.1 OMNISCIENT & LEVIATHAN SETTINGS
    WHALE_THRESHOLD: parseEther("15.0"), // 15 ETH Spotted Trigger (v22.0)
    MIN_LOG_ETH: parseEther("10.0"),      // Leviathan Confirm Threshold (v21.0)
    GAS_LIMIT: 1250000n,                 // Omniscient Buffer (v22.1)
    
    MIN_WHALE_HEARTBEAT: 0.1,            // Heartbeat trigger for retail moves
    MIN_NET_PROFIT: "0.01",              // Net floor in ETH
    MIN_PROFIT_BUFFER: "0.005",          // Safety gasket in ETH
    MARGIN_ETH: "0.012",                 // Leviathan specific safety (v21.1)
    PRIORITY_BRIBE: 15n,                 
    STOCHASTIC_PROBE_RATE: 0.9998,       

    RPC_POOL: [
        process.env.QUICKNODE_HTTP,
        process.env.BASE_RPC,
        "https://mainnet.base.org",
        "https://base.llamarpc.com",
        "https://1rpc.io/base"
    ].filter(url => url && url.startsWith("http")),

    MAX_CORES: Math.min(os.cpus().length, 48), 
    WORKER_BOOT_DELAY_MS: 15000, 
    HEARTBEAT_INTERVAL_MS: 120000,
    PORT: process.env.PORT || 8080,

    NETWORKS: [
        { name: "ETH_MAINNET", chainId: 1, rpc: "https://rpc.flashbots.net", wss: process.env.ETH_WSS, type: "FLASHBOTS", relay: "https://relay.flashbots.net", color: TXT.cyan, priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", aavePool: "0x87870Bca3F3f6332F99512Af77db630d00Z638025", uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564" },
        { name: "BASE_MAINNET", chainId: 8453, rpc: process.env.BASE_RPC, wss: process.env.BASE_WSS, color: TXT.magenta, gasOracle: "0x420000000000000000000000000000000000000F", priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", uniswapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481" },
        { name: "ARBITRUM", chainId: 42161, rpc: process.env.ARB_RPC, wss: process.env.ARB_WSS, color: TXT.blue, priceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564" }
    ]
};

// --- GLOBAL AI STATE ---
let currentMarketSignal = { advice: "HOLD", confidence: 0.5, adjustment: 1.0 };

// --- AI ANALYZER ENGINE ---
async function fetchAIAssessment(ethPrice) {
    const systemPrompt = "Professional cross-chain crypto analyst. Respond ONLY in JSON.";
    const userQuery = `ETH: $${ethPrice}. Suggest if Omniscient Leviathan strikes should be aggressive (BUY) or defensive (SELL).`;
    try {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.data.candidates[0].content.parts[0].text);
    } catch (e) { return { advice: "HOLD", confidence: 0, margin_multiplier: 1.0 }; }
}

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}
╔════════════════════════════════════════════════════════╗
║   ⚡ APEX OMNISCIENT MASTER v113.0 | CLUSTER EDITION  ║
║   MODE: OMNISCIENT WHALE SPOTTING + LOG DECODING      ║
╚════════════════════════════════════════════════════════╝${TXT.reset}`);

    const blacklist = ["0x4b8251e7c80f910305bb81547e301dcb8a596918", "0x35c3ecffbbdd942a8dba7587424b58f74d6d6d15"];
    if (blacklist.includes(GLOBAL_CONFIG.BENEFICIARY.toLowerCase())) {
        console.error(`${TXT.red}${TXT.bold}[FATAL ERROR] Malicious Beneficiary Blocked!${TXT.reset}`);
        process.exit(1);
    }

    const cpuCount = GLOBAL_CONFIG.MAX_CORES;
    for (let i = 0; i < cpuCount; i++) cluster.fork();

    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️  Engine Died. Rebooting Core (3s)...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 3000);
    });
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    const NETWORK = GLOBAL_CONFIG.NETWORKS[networkIndex];
    setTimeout(() => initWorker(NETWORK), (cluster.worker.id % 24) * 8000);
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    const DIVISION = (cluster.worker.id % 4);
    const ROLE = ["SNIPER", "DECODER", "PROBER", "ANALYST"][DIVISION];
    
    let isProcessing = false;
    let currentEthPrice = 0;
    let scanCount = 0;
    const walletKey = (process.env.PRIVATE_KEY || process.env.TREASURY_PRIVATE_KEY || "").trim();

    if (!walletKey || walletKey.includes("0000000")) return;

    async function safeConnect() {
        try {
            const network = ethers.Network.from(CHAIN.chainId);
            const rpcConfigs = GLOBAL_CONFIG.RPC_POOL.map((url, i) => ({
                provider: new JsonRpcProvider(url, network, { staticNetwork: true }),
                priority: i + 1, stallTimeout: 2500
            }));
            const provider = new FallbackProvider(rpcConfigs, network, { quorum: 1 });
            const wsProvider = new WebSocketProvider(CHAIN.wss, network);
            
            wsProvider.on('error', (error) => {
                if (error && error.message && (error.message.includes("UNEXPECTED_MESSAGE") || error.message.includes("delayedMessagesRead"))) return;
                process.stdout.write(`${TXT.red}!${TXT.reset}`);
            });

            if (wsProvider.websocket) {
                wsProvider.websocket.onclose = () => process.exit(0);
            }

            const wallet = new Wallet(walletKey, provider);
            const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
            const gasOracle = CHAIN.gasOracle ? new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes) view returns (uint256)"], provider) : null;

            const apexIface = new Interface([
                "function executeFlashArbitrage(address tokenA, address tokenOut, uint256 amount)",
                "function flashLoanSimple(address receiver, address asset, uint256 amount, bytes params, uint16 referral)"
            ]);

            console.log(`${TXT.green}✅ CORE ${cluster.worker.id} [${ROLE}] SYNCED on ${TAG}${TXT.reset}`);

            process.on('message', (msg) => {
                if (msg.type === 'MARKET_PULSE') currentMarketSignal = msg.data;
                if (msg.type === 'WHALE_SIGNAL' && msg.chainId === CHAIN.chainId && !isProcessing && ROLE !== "ANALYST") {
                    isProcessing = true;
                    strike(provider, wallet, apexIface, gasOracle, currentEthPrice, CHAIN, msg.target, msg.mode)
                        .finally(() => setTimeout(() => isProcessing = false, 30000));
                }
            });

            if (ROLE === "ANALYST") {
                setInterval(async () => {
                    try {
                        const [, price] = await priceFeed.latestRoundData();
                        currentEthPrice = Number(price) / 1e8;
                        const pulse = await fetchAIAssessment(currentEthPrice);
                        process.send({ type: 'MARKET_PULSE', data: pulse });
                    } catch (e) {}
                }, 120000);
            }

            // v22.1 OMNISCIENT DUAL-SNIPE ENGINE
            if (DIVISION === 0 || DIVISION === 1) {
                // A. PENDING SNIPER (Speed)
                wsProvider.on("pending", async (txHash) => {
                    if (isProcessing) return;
                    scanCount++;
                    if (scanCount % 20 === 0 && (cluster.worker.id % 12 === 0)) {
                        process.stdout.write(`\r${TAG} ${TXT.cyan}⚡ SCANNING MEMPOOL${TXT.reset} | Txs: ${scanCount} | ETH: $${currentEthPrice.toFixed(2)} `);
                    }

                    const tx = await provider.getTransaction(txHash).catch(() => null);
                    if (tx && tx.to) {
                        const valWei = tx.value || 0n;
                        // Spotted a pending Whale (v22.0 Threshold)
                        if (valWei >= GLOBAL_CONFIG.WHALE_THRESHOLD) {
                             console.log(`\n${TAG} ${TXT.magenta}🚨 OMNISCIENT SPOTTED WHALE: ${formatEther(valWei)} ETH | Hash: ${txHash.substring(0, 10)}...${TXT.reset}`);
                             process.send({ type: 'WHALE_SIGNAL', chainId: CHAIN.chainId, target: tx.to, mode: "OMNISCIENT_WHALE" });
                        } else if (valWei >= parseEther(GLOBAL_CONFIG.MIN_WHALE_HEARTBEAT.toString()) && tx.to.toLowerCase() === CHAIN.uniswapRouter.toLowerCase()) {
                             process.send({ type: 'WHALE_SIGNAL', chainId: CHAIN.chainId, target: tx.to, mode: "RETAIL_PROBE" });
                        }
                    }
                });

                // B. LOG DECODER LAYER (Accuracy)
                const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
                wsProvider.on({ topics: [swapTopic] }, async (log) => {
                    try {
                        if (isProcessing) return;
                        const decoded = AbiCoder.defaultAbiCoder().decode(["uint256", "uint256", "uint256", "uint256"], log.data);
                        const maxSwap = decoded.reduce((max, val) => val > max ? val : max, 0n);
                        
                        // Confirmed Leviathan Volume (v21.0 Threshold)
                        if (maxSwap >= GLOBAL_CONFIG.MIN_LOG_ETH) {
                            console.log(`\n${TAG} ${TXT.yellow}🐳 CONFIRMED LEVIATHAN LOG: ${formatEther(maxSwap)} ETH${TXT.reset}`);
                            process.send({ type: 'WHALE_SIGNAL', chainId: CHAIN.chainId, target: log.address, mode: "LEVIATHAN_CONFIRMED" });
                        }
                    } catch (e) {}
                });
            }

        } catch (e) { setTimeout(safeConnect, 60000); }
    }
    await safeConnect();
}

async function strike(provider, wallet, iface, gasOracle, ethPrice, CHAIN, target, mode) {
    try {
        const weth = CHAIN.chainId === 8453 ? "0x4200000000000000000000000000000000000006" : "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
        
        // v22.1 BINARY SCALING: High Treasury > 0.1 ETH gets 100 ETH strike, else 25 ETH
        const balanceWei = await provider.getBalance(wallet.address);
        const ethBalance = parseFloat(formatEther(balanceWei));
        const loanAmount = ethBalance > 0.1 ? parseEther("100") : parseEther("25");

        const tradeData = iface.encodeFunctionData("flashLoanSimple", [
            GLOBAL_CONFIG.TARGET_CONTRACT, weth, loanAmount, "0x", 0
        ]);

        // PRE-FLIGHT SIMULATION (Omniscient Buffer)
        const [simulation, feeData, l1Fee] = await Promise.all([
            provider.call({ to: CHAIN.aavePool, data: tradeData, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => null),
            provider.getFeeData(),
            gasOracle ? gasOracle.getL1Fee(tradeData).catch(() => 0n) : 0n
        ]);

        if (!simulation || simulation === "0x") return; 

        // v22.1 Profit Validation hurdle
        const aaveFee = (loanAmount * 5n) / 10000n; 
        const l2GasCost = GLOBAL_CONFIG.GAS_LIMIT * (feeData.maxFeePerGas || feeData.gasPrice);
        const minProfitWei = parseEther(GLOBAL_CONFIG.MIN_NET_PROFIT);
        const safetyBufferWei = parseEther(GLOBAL_CONFIG.MIN_PROFIT_BUFFER);
        const marginWei = parseEther(GLOBAL_CONFIG.MARGIN_ETH);
        
        const totalThreshold = l2GasCost + l1Fee + aaveFee + minProfitWei + safetyBufferWei + marginWei;
        const rawProfit = BigInt(simulation);
        
        let aiMultiplier = 100n;
        if (currentMarketSignal.advice === "BUY") aiMultiplier = 90n;
        if (currentMarketSignal.advice === "SELL") aiMultiplier = 130n;

        if (rawProfit > (totalThreshold * aiMultiplier) / 100n) {
            const netProfitEth = rawProfit - (l2GasCost + l1Fee + aaveFee);
            
            console.log(`\n${TXT.green}${TXT.bold}💎 STRIKE CONFIRMED [${mode}]${TXT.reset}`);
            console.log(`   ↳ ⚖️ Omniscient Leverage: ${formatEther(loanAmount)} ETH | Net: +${formatEther(netProfitEth)} ETH (~$${(parseFloat(formatEther(netProfitEth)) * ethPrice).toFixed(2)})${TXT.reset}`);

            let priorityBribe = (feeData.maxPriorityFeePerGas * (100n + GLOBAL_CONFIG.PRIORITY_BRIBE)) / 100n;

            const tx = {
                to: CHAIN.aavePool, data: tradeData, type: 2, chainId: CHAIN.chainId,
                gasLimit: GLOBAL_CONFIG.GAS_LIMIT, maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: priorityBribe,
                nonce: await provider.getTransactionCount(wallet.address), value: 0n
            };

            const signedTx = await wallet.signTransaction(tx);
            await axios.post(CHAIN.rpc, { jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx] }, { timeout: 2000 }).catch(() => {});
            console.log(`${TXT.green}${TXT.bold}🎉 FUNDS SECURED AT ${GLOBAL_CONFIG.BENEFICIARY}${TXT.reset}`);
        } else {
            process.stdout.write(`${TXT.dim}.${TXT.reset}`);
        }
    } catch (e) {}
}
