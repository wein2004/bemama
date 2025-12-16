<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// === 狀態管理 ===
const user = ref(null)
const viewState = ref('login')
const currentTab = ref('')

// === 資料 ===
const loginForm = ref({ username: '', password: '', role: 'doctor' })
const patients = ref([])
const medicines = ref([]) 
const orderHistory = ref([])

// === 搜尋建議狀態 ===
const medSuggestions = ref([]) 
const activeSearch = ref({ type: null, index: -1 })
const patientSuggestions = ref([])
const showPatientSuggestions = ref(false)

// === 表單資料 ===
const newPatientForm = ref({
  patientNumber: '', firstName: '', lastName: '', gender: 'Male',
  tel: '', mobile: '', address: '', city: '', state: '', zip: '', country: ''
})
const showPatientModal = ref(false)

const rxForm = ref({
  date: new Date().toISOString().split('T')[0],
  patientId: '',
  patientNameInput: '',
  isPregnant: false,
  
  // 預設格子
  formulas: Array.from({ length: 3 }, () => ({ name: '', dose: '' })),
  herbs: Array.from({ length: 16 }, () => ({ name: '', dose: '' })),
  
  formType: 'Granule',
  packageMethod: 'Bottle',
  
  // 詳細欄位
  bottle: { totalQty: '', totalCaps: '', dose: '', times: '', timing: 'after' },
  sachet: { dose: '', times: '', timing: 'after', days: '' },
  label: { usage: false, name: false, date: false, ingName: false, ingDose: false },
  otherNotes: '',
  bemaNotes: '',
  
  // 🔥 Shipping & Payment (依照截圖還原)
  shippingType: 'Regular', // Urgent, Express, Regular
  shipTo: 'Clinic',        // Clinic, Pickup, Patient
  patientShipOption: 'Same', // Same, Other (當 shipTo == Patient 時用)
  
  // 詳細運送資料
  shipDetail: { city: '', state: '', zip: '', country: '', tel: '' },
  
  payment: 'Credit Card'
})

// === 核心邏輯 ===
const handleLogin = async () => {
  try {
    const res = await fetch('http://localhost:3001/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm.value)
    })
    const data = await res.json()
    if (data.success) {
      user.value = data.user
      viewState.value = 'dashboard'
      if (user.value.role === 'doctor') {
        currentTab.value = 'new-rx'
        loadData()
      }
    } else { alert(data.message) }
  } catch(e) { alert('連線失敗') }
}

const loadData = async () => {
  const [pRes, mRes, oRes] = await Promise.all([
    fetch('http://localhost:3001/api/patients'),
    fetch('http://localhost:3001/api/medicines'),
    fetch('http://localhost:3001/api/orders')
  ])
  patients.value = await pRes.json()
  medicines.value = await mRes.json()
  orderHistory.value = await oRes.json()
}

// 病人搜尋
const onPatientInput = () => {
  const input = rxForm.value.patientNameInput.toLowerCase()
  if (!input) { patientSuggestions.value = []; showPatientSuggestions.value = false; return }
  patientSuggestions.value = patients.value.filter(p => 
    p.first_name.toLowerCase().includes(input) || p.last_name.toLowerCase().includes(input)
  )
  showPatientSuggestions.value = true
}
const selectPatient = (p) => {
  rxForm.value.patientId = p.id
  rxForm.value.patientNameInput = `${p.first_name} ${p.last_name}`
  
  // 自動帶入運送資料
  if(p.city) rxForm.value.shipDetail.city = p.city
  if(p.state) rxForm.value.shipDetail.state = p.state
  if(p.zip_code) rxForm.value.shipDetail.zip = p.zip_code
  if(p.country) rxForm.value.shipDetail.country = p.country
  if(p.mobile) rxForm.value.shipDetail.tel = p.mobile
  
  showPatientSuggestions.value = false
}

// 藥材搜尋
const onMedInput = (type, index) => {
  const input = rxForm.value[type][index].name.toLowerCase()
  activeSearch.value = { type, index }
  if (!input) { medSuggestions.value = []; return }
  medSuggestions.value = medicines.value.filter(m => m.name.toLowerCase().includes(input))
}
const selectMed = (med) => {
  const { type, index } = activeSearch.value
  rxForm.value[type][index].name = med.name
  medSuggestions.value = []
  activeSearch.value = { type: null, index: -1 }
}
const closeSuggestions = (e) => {
  if (!e.target.closest('.autocomplete-wrapper')) {
    showPatientSuggestions.value = false
    activeSearch.value = { type: null, index: -1 }
  }
}
onMounted(() => document.addEventListener('click', closeSuggestions))
onUnmounted(() => document.removeEventListener('click', closeSuggestions))

const createPatient = async () => {
  await fetch('http://localhost:3001/api/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...newPatientForm.value, doctorId: user.value.id })
  })
  alert('Patient Created!')
  showPatientModal.value = false
  loadData()
}

const submitOrder = async () => {
  if (!rxForm.value.patientId) return alert('Select a patient first')
  const validFormulas = rxForm.value.formulas.filter(f => f.name && f.dose)
  const validHerbs = rxForm.value.herbs.filter(h => h.name && h.dose)
  
  await fetch('http://localhost:3001/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctorId: user.value.id,
      patientId: rxForm.value.patientId,
      shipping: rxForm.value.shippingType,
      content: { ...rxForm.value, formulas: validFormulas, herbs: validHerbs }
    })
  })
  alert('Order Submitted!')
  currentTab.value = 'history'
  loadData()
}

const logout = () => { user.value = null; viewState.value = 'login' }
</script>

<template>
  <div class="app-root">
    
    <div v-if="viewState === 'login'" class="auth-box">
      <h1>BEMA DEMO</h1>
      <select v-model="loginForm.role" class="input-field"><option value="doctor">Doctor</option><option value="admin">Admin</option></select>
      <input v-model="loginForm.username" placeholder="Username" class="input-field">
      <input v-model="loginForm.password" type="password" placeholder="Password" class="input-field">
      <button @click="handleLogin" class="btn-primary">Login</button>
    </div>

    <div v-else class="layout">
      <aside class="sidebar">
        <div class="brand">OPOS</div>
        <div class="user-display">Dr. {{ user.name }}</div>
        <nav>
          <div class="menu-item" @click="currentTab='new-rx'" :class="{active: currentTab==='new-rx'}">New Patient RX</div>
          <div class="menu-item" @click="currentTab='my-patients'" :class="{active: currentTab==='my-patients'}">My Patients</div>
          <div class="menu-item" @click="currentTab='history'" :class="{active: currentTab==='history'}">Order History</div>
          <div class="menu-item logout" @click="logout">Logout</div>
        </nav>
      </aside>

      <main class="content">
        <div v-if="currentTab === 'new-rx'" class="paper-form">
          <h2 class="form-title">Prescription Dispensing Service <br> Order Form</h2>
          
          <table class="header-table">
            <tr>
              <td class="label-bg">Date</td><td class="value-bg"><input type="date" v-model="rxForm.date"></td>
              <td class="label-bg">Practitioner</td><td class="value-bg">{{ user.name }}</td>
            </tr>
            <tr>
              <td colspan="4" class="patient-row">
                <div class="input-group autocomplete-wrapper">
                  <label>Name of Patient:</label>
                  <input v-model="rxForm.patientNameInput" @input="onPatientInput" placeholder="Search..." class="search-input">
                  <ul v-if="showPatientSuggestions" class="suggestions-list">
                    <li v-for="p in patientSuggestions" :key="p.id" @click="selectPatient(p)">{{ p.first_name }} {{ p.last_name }}</li>
                  </ul>
                  <label class="preg-label"><input type="checkbox" v-model="rxForm.isPregnant"> Pregnancy Consideration</label>
                </div>
              </td>
            </tr>
          </table>

          <div class="section-header">Rx: PRESCRIPTION LIST</div>
          
          <table class="rx-table">
            <tr class="table-head"><th width="30">#</th><th>Formula Name 複方藥名</th><th width="80">Dose</th></tr>
            <tr v-for="(item, idx) in rxForm.formulas" :key="'f'+idx">
              <td class="row-num">{{ idx + 1 }}</td>
              <td>
                <div class="autocomplete-wrapper">
                  <input v-model="item.name" @input="onMedInput('formulas', idx)" class="table-input">
                  <ul v-if="activeSearch.type === 'formulas' && activeSearch.index === idx && medSuggestions.length > 0" class="suggestions-list">
                    <li v-for="m in medSuggestions" :key="m.id" @click="selectMed(m)">{{ m.name }} ({{ m.stock_quantity }})</li>
                  </ul>
                </div>
              </td>
              <td><input v-model="item.dose" type="number" class="table-input text-right"></td>
            </tr>
          </table>

          <div class="desc-row">Formula Description</div>

          <table class="rx-table mt-0">
            <tr class="table-head"><th width="30">#</th><th>Herb Name 藥名</th><th width="80">Dose</th></tr>
            <tr v-for="(item, idx) in rxForm.herbs" :key="'h'+idx">
              <td class="row-num">{{ idx + 4 }}</td>
              <td>
                <div class="autocomplete-wrapper">
                  <input v-model="item.name" @input="onMedInput('herbs', idx)" class="table-input">
                  <ul v-if="activeSearch.type === 'herbs' && activeSearch.index === idx && medSuggestions.length > 0" class="suggestions-list">
                    <li v-for="m in medSuggestions" :key="m.id" @click="selectMed(m)">{{ m.name }} ({{ m.stock_quantity }})</li>
                  </ul>
                </div>
              </td>
              <td><input v-model="item.dose" type="number" class="table-input text-right"></td>
            </tr>
          </table>

          <div class="section-header mt-4">DOSAGE FORM & QUANTITY & Package Method</div>
          <div class="dosage-box">
            <div class="dosage-type">
              <label><input type="radio" value="Granule" v-model="rxForm.formType"> Granule</label>
              <label><input type="radio" value="Capsule" v-model="rxForm.formType"> Capsule</label>
              <label><input type="radio" value="Tablet" v-model="rxForm.formType"> Tablet</label>
            </div>
            
            <div class="dosage-method" :class="{disabled: rxForm.packageMethod !== 'Bottle'}">
              <div class="method-title"><input type="radio" value="Bottle" v-model="rxForm.packageMethod"> <b>Bottle</b></div>
              <div>Prorate the prescription into a total of <input v-model="rxForm.bottle.totalQty" class="input-xs"> grams or <input v-model="rxForm.bottle.totalCaps" class="input-xs"> caps</div>
              <div class="mt-1">Take <input v-model="rxForm.bottle.dose" class="input-xs"> gram(s) each time, <input v-model="rxForm.bottle.times" class="input-xs"> times/day,</div>
              <div class="mt-1">
                <label><input type="radio" value="before" v-model="rxForm.bottle.timing"> before</label>
                <label><input type="radio" value="with" v-model="rxForm.bottle.timing"> with</label>
                <label><input type="radio" value="after" v-model="rxForm.bottle.timing"> after</label> meal.
              </div>
            </div>

            <div class="dosage-method" :class="{disabled: rxForm.packageMethod !== 'Sachet'}">
              <div class="method-title"><input type="radio" value="Sachet" v-model="rxForm.packageMethod"> <b>Sachet</b></div>
              <div>Take <input v-model="rxForm.sachet.dose" class="input-xs"> gram(s) each time, <input v-model="rxForm.sachet.times" class="input-xs"> times/day,</div>
              <div class="mt-1">
                <label><input type="radio" value="before" v-model="rxForm.sachet.timing"> before</label>
                <label><input type="radio" value="with" v-model="rxForm.sachet.timing"> with</label>
                <label><input type="radio" value="after" v-model="rxForm.sachet.timing"> after</label> meal
              </div>
              <div class="mt-1">for <input v-model="rxForm.sachet.days" class="input-xs"> days.</div>
            </div>
          </div>

          <div class="section-header mt-2">LABEL (Please tick what is to be displayed)</div>
          <div class="label-box">
            <div class="label-checks">
              <label><input type="checkbox" v-model="rxForm.label.usage"> Usage /taking direction</label>
              <label><input type="checkbox" v-model="rxForm.label.name"> Patient's Name</label>
              <label><input type="checkbox" v-model="rxForm.label.date"> Date of Dispensing</label>
              <label><input type="checkbox" v-model="rxForm.label.ingName"> Ingredient name only (no dose)</label>
              <label><input type="checkbox" v-model="rxForm.label.ingDose"> Ingredient name + dose</label>
            </div>
            <div class="label-notes">
              <div>Other Notes:</div><textarea v-model="rxForm.otherNotes" rows="2"></textarea>
            </div>
          </div>

          <div class="section-header mt-2">Notes for BEMA</div>
          <textarea v-model="rxForm.bemaNotes" class="full-textarea" rows="2"></textarea>

          <div class="ship-pay-box mt-2">
            <div class="shipping-col">
              <div class="sub-h">SHIPPING REQUEST</div>
              <div class="radio-stack">
                <label class="red-text"><input type="radio" value="Urgent" v-model="rxForm.shippingType"> <b>Urgent</b>: same day service</label>
                <label class="blue-text"><input type="radio" value="Express" v-model="rxForm.shippingType"> <b>Express</b>: ship out within 24 hour</label>
                <label class="green-text"><input type="radio" value="Regular" v-model="rxForm.shippingType"> <b>Regular</b>: Standard shipment</label>
              </div>
              <hr class="divider">
              <div><b>Payment Option:</b></div>
              <div class="payment-row">
                <label><input type="radio" value="Credit Card" v-model="rxForm.payment"> Credit Card</label>
                <label><input type="radio" value="Cheque" v-model="rxForm.payment"> Cheque</label>
                <label><input type="radio" value="Debit/Cash" v-model="rxForm.payment"> Debit/Cash</label>
              </div>
            </div>

            <div class="address-col">
              <div><label><input type="radio" value="Clinic" v-model="rxForm.shipTo"> Ship to my mailing address</label></div>
              <div><label><input type="radio" value="Pickup" v-model="rxForm.shipTo"> Will arrange a Self Pick Up</label></div>
              <div><label><input type="radio" value="Patient" v-model="rxForm.shipTo"> Ship to Patient</label></div>
              
              <div class="nested-opts">
                <div><label><input type="radio" value="Same" v-model="rxForm.patientShipOption" :disabled="rxForm.shipTo!=='Patient'"> Same registered Address.</label></div>
                <div><label><input type="radio" value="Other" v-model="rxForm.patientShipOption" :disabled="rxForm.shipTo!=='Patient'"> Other Address:</label></div>
              </div>

              <div class="addr-grid">
                <div class="addr-row">
                  <span>City:</span><input v-model="rxForm.shipDetail.city" class="addr-input">
                  <span>Province/State:</span><input v-model="rxForm.shipDetail.state" class="addr-input">
                </div>
                <div class="addr-row">
                  <span>ZipCode:</span><input v-model="rxForm.shipDetail.zip" class="addr-input">
                  <span>Country:</span><input v-model="rxForm.shipDetail.country" class="addr-input">
                </div>
                <div class="addr-row">
                  <span>TEL:</span><input v-model="rxForm.shipDetail.tel" class="addr-input">
                </div>
              </div>
            </div>
          </div>

          <div class="action-bar">
            <button class="submit-btn" @click="submitOrder">submit</button>
            <button class="force-btn" @click="submitOrder">force</button>
          </div>
        </div>

        <div v-if="currentTab === 'my-patients'" class="paper">
          <div class="flex-between"><h2>Patients</h2><button @click="showPatientModal=true" class="btn-primary">+ New</button></div>
          <table class="data-table">
            <thead><tr><th>Name</th><th>Mobile</th><th>City</th></tr></thead>
            <tbody><tr v-for="p in patients" :key="p.id"><td>{{ p.first_name }} {{ p.last_name }}</td><td>{{ p.mobile }}</td><td>{{ p.city }}</td></tr></tbody>
          </table>
          <div v-if="showPatientModal" class="modal-overlay">
            <div class="modal-content yellow-style">
              <h3>New Patient</h3>
              <div class="form-grid">
                <label>First Name:</label><input v-model="newPatientForm.firstName">
                <label>Last Name:</label><input v-model="newPatientForm.lastName">
                <label>Mobile:</label><input v-model="newPatientForm.mobile">
              </div>
              <div class="modal-footer"><button @click="createPatient" class="btn-reg">Create</button><button @click="showPatientModal=false">Cancel</button></div>
            </div>
          </div>
        </div>

        <div v-if="currentTab === 'history'" class="paper">
          <h2>Order History</h2>
          <table class="data-table">
            <thead><tr><th>Order No</th><th>Status</th></tr></thead>
            <tbody><tr v-for="o in orderHistory" :key="o.id"><td>{{ o.order_no }}</td><td>{{ o.status }}</td></tr></tbody>
          </table>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* 共用 */
.app-root { font-family: Arial, sans-serif; height: 100vh; background: #fdfdfd; display: flex; flex-direction: column; color: #333; }
.auth-box { margin: auto; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; color: #333; }
.input-field { display: block; width: 250px; margin: 10px auto; padding: 10px; border: 1px solid #ddd; background: white; color: #333; }
.layout { display: flex; height: 100vh; }
.sidebar { width: 220px; background: #2c3e50; color: white; display: flex; flex-direction: column; }
.brand { padding: 20px; font-size: 24px; font-weight: bold; background: #1a252f; }
.menu-item { padding: 15px 20px; cursor: pointer; border-left: 4px solid transparent; }
.menu-item.active { background: #34495e; border-left-color: #3498db; color: #3498db; }
.content { flex: 1; padding: 20px; overflow-y: auto; background: #ffffed; }
.paper-form { max-width: 900px; margin: 0 auto; background: #fff; padding: 10px; border: 1px solid #999; }
.header-table { width: 100%; border-collapse: collapse; border: 2px solid #999; margin-bottom: 10px; }
.header-table td { border: 1px solid #999; padding: 5px; }
.label-bg { background: #b0c4de; font-weight: bold; width: 150px; }

/* 搜尋選單樣式 */
.autocomplete-wrapper { position: relative; width: 100%; }
.suggestions-list { position: absolute; top: 100%; left: 0; width: 100%; background: white; border: 1px solid #ccc; list-style: none; padding: 0; margin: 0; z-index: 100; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
.suggestions-list li { padding: 8px; cursor: pointer; border-bottom: 1px solid #eee; font-size: 14px; }
.suggestions-list li:hover { background: #e6f7ff; }

/* RX Table */
.section-header { background: #b0c4de; padding: 5px; font-weight: bold; border: 1px solid #999; margin-top: 5px; border-bottom: none; }
.rx-table { width: 100%; border-collapse: collapse; border: 1px solid #999; background: #ffffcc; table-layout: fixed; }
.rx-table th { border: 1px solid #999; padding: 5px; text-align: left; background: #eee; }
.rx-table td { border: 1px solid #999; padding: 0; position: relative; } 
.table-input { width: 100%; border: none; background: transparent; padding: 8px; box-sizing: border-box; font-size: 14px; }
.text-right { text-align: right; }
.row-num { text-align: center; background: #f9f9f9; font-size: 12px; color: #666; }
.desc-row { background: #ffffcc; padding: 5px; font-size: 14px; border: 1px solid #999; border-top: none; }

/* Dosage & Label & Shipping */
.dosage-box, .label-box, .ship-pay-box { display: flex; border: 1px solid #999; background: #ffffcc; }
.dosage-type, .label-checks, .shipping-col { flex: 1; padding: 10px; border-right: 1px solid #999; }
.dosage-method, .label-notes, .address-col { flex: 1; padding: 10px; }
.dosage-method.disabled { color: #aaa; background: #f0f0f0; }
.input-xs { width: 50px; border: 1px solid #ccc; text-align: center; }
.full-textarea { width: 100%; border: 1px solid #999; padding: 5px; background: white; }
.sub-h { background: #b0c4de; font-weight: bold; padding: 2px 5px; margin-bottom: 5px; }
.divider { border: 0; border-top: 1px solid #999; margin: 10px 0; }

/* Shipping & Payment specific */
.red-text b { color: red; } .blue-text b { color: blue; } .green-text b { color: green; }
.radio-stack label { display: block; margin-bottom: 2px; font-size: 14px; }
.payment-row { display: flex; flex-wrap: wrap; gap: 10px; font-size: 14px; margin-top: 5px; }
.nested-opts { margin-left: 20px; font-size: 14px; margin-bottom: 10px; }
.addr-grid { background: #ffffcc; }
.addr-row { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; font-size: 14px; }
.addr-input { border: none; border-bottom: 1px solid #999; background: #fff; width: 100px; padding: 2px; }

/* Buttons */
.action-bar { text-align: center; margin-top: 20px; }
.submit-btn { background: #eee; border: 1px solid #999; padding: 5px 20px; font-size: 16px; font-weight: bold; cursor: pointer; border-radius: 5px; box-shadow: 1px 1px 3px #ccc; margin-right: 10px; }
.force-btn { background: #eee; border: 1px solid #999; padding: 5px 20px; font-size: 16px; color: #999; cursor: pointer; border-radius: 5px; box-shadow: 1px 1px 3px #ccc; }

/* Modal & Misc */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 200; }
.modal-content.yellow-style { background: #ffffcc; border: 2px solid #999; padding: 20px; width: 400px; }
.form-grid { display: grid; grid-template-columns: 100px 1fr; gap: 10px; margin-top: 10px; }
.btn-primary, .btn-reg { background: #3498db; color: white; padding: 8px 16px; border: none; cursor: pointer; }
.mt-2 { margin-top: 10px; } .mt-4 { margin-top: 20px; }
.paper { background: white; padding: 20px; max-width: 900px; margin: 0 auto; border: 1px solid #ccc; color: #333; }
.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
.data-table th, .data-table td { padding: 8px; border: 1px solid #ddd; text-align: left; color: #333; }
</style>