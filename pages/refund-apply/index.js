const WXAPI = require('apifm-wxapi')
const CONFIG = require('../../config.js')
const APP = getApp()

Page({
  data: {
    orderId: null,
    goods: [],
    refundApplyList: [],
    
    // 当前选择的商品
    goodsIndex: null,
    curGoods: null,
    number: 1,
    
    // 售后类型
    type: '0',
    typeItems: [
      { name: '', value: '0' },
      { name: '', value: '1' },
      { name: '', value: '2' },
    ],
    
    // 物流状态
    logisticsStatus: '0',
    logisticsStatusItems: [
      { name: '', value: '0' },
      { name: '', value: '1' }
    ],
    
    // 售后原因
    reason: '',
    reasons: [],
    
    // 备注和图片
    remark: '',
    picsList: [],
    pics: [],
    
    // 弹窗相关
    popShow: false,
    curRufund: null,
    imageList: [],
    logisticsContent: null,
    
    // 快递信息弹窗
    logisticsDialogShow: false,
    shipperName: '',
    trackingNumber: '',
    
    customerServiceType: CONFIG.customerServiceType
  },

  onLoad(options) {
    APP.initLanguage(this)
    this.setData({
      orderId: options.id,
      typeItems: [
        { name: this.data.$t.refund.type0, value: '0' },
        { name: this.data.$t.refund.type1, value: '1' },
        { name: this.data.$t.refund.type2, value: '2' },
      ],
      logisticsStatusItems: [
        { name: this.data.$t.refund.logisticsStatus0, value: '0' },
        { name: this.data.$t.refund.logisticsStatus1, value: '1' }
      ],
      reasons: this.data.$t.refund.reasons,
      reason: this.data.$t.refund.reasons[0]
    })
    wx.setNavigationBarTitle({
      title: this.data.$t.refund.title
    })
    this.orderDetail()
  },

  async orderDetail() {
    wx.showLoading({ title: '' })
    const token = wx.getStorageSync('token')
    const res = await WXAPI.orderDetail(token, this.data.orderId)
    wx.hideLoading()
    
    if (res.code != 0) {
      wx.showModal({
        content: res.msg,
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
      return
    }
    
    // 处理商品售后支持信息
    res.data.goods.forEach(ele => {
      if (ele.afterSale) {
        ele.afterSale.split(',').forEach(a => {
          ele['afterSale' + a] = true
        })
      }
    })
    
    // 读取已申请售后记录
    const res2 = await WXAPI.refundApplyDetail(token, this.data.orderId)
    let refundApplyList = []
    if (res2.code == 0) {
      res2.data.forEach(ele => {
        ele.goodInfo = res.data.goods.find(g => g.id == ele.baseInfo.orderGoodsId)
      })
      refundApplyList = res2.data
    }
    
    this.setData({
      goods: res.data.goods,
      refundApplyList
    })
  },

  // 选择商品
  goodsClick(e) {
    const goodsIndex = e.currentTarget.dataset.name
    const curGoods = this.data.goods[goodsIndex]
    if (!curGoods || !curGoods.afterSale) {
      return
    }
    this.setData({
      goodsIndex,
      curGoods,
      number: curGoods.number
    })
  },

  // 修改数量
  numberChange(e) {
    let number = e.detail
    if (!number || number < 1) {
      number = 1
    }
    if (number > this.data.curGoods.number) {
      number = this.data.curGoods.number
    }
    this.setData({
      number
    })
  },

  // 售后类型选择
  typeChange(e) {
    this.setData({
      type: e.detail
    })
  },

  typeClick(e) {
    const { name } = e.currentTarget.dataset
    this.setData({
      type: name
    })
  },

  // 物流状态选择
  logisticsStatusChange(e) {
    this.setData({
      logisticsStatus: e.detail
    })
  },

  logisticsStatusClick(e) {
    const { name } = e.currentTarget.dataset
    this.setData({
      logisticsStatus: name
    })
  },

  // 售后原因选择
  reasonChange(e) {
    this.setData({
      reason: e.detail
    })
  },

  reasonClick(e) {
    const { name } = e.currentTarget.dataset
    this.setData({
      reason: name
    })
  },

  // 图片上传
  afterPicRead(e) {
    let picsList = this.data.picsList || []
    picsList = picsList.concat(e.detail.file)
    this.setData({
      picsList
    })
  },

  afterPicDel(e) {
    let picsList = this.data.picsList
    picsList.splice(e.detail.index, 1)
    this.setData({
      picsList
    })
  },

  // 提交申请
  async bindSave() {
    if (!this.data.curGoods) {
      wx.showToast({
        title: this.data.$t.refund.selectGoods,
        icon: 'none'
      })
      return
    }

    let amount = this.data.curGoods.amountSingle * this.data.number
    if (this.data.type == 2) {
      amount = 0.00
    }

    wx.showLoading({ title: '' })
    
    // 批量上传附件
    this.data.pics = []
    if (this.data.picsList) {
      for (let index = 0; index < this.data.picsList.length; index++) {
        const pic = this.data.picsList[index]
        const res = await WXAPI.uploadFileV2(wx.getStorageSync('token'), pic.url)
        if (res.code == 0) {
          this.data.pics.push(res.data.url)
        }
      }
    }

    const res = await WXAPI.refundApply({
      token: wx.getStorageSync('token'),
      orderId: this.data.orderId,
      orderGoodsId: this.data.curGoods.id,
      type: this.data.type,
      logisticsStatus: this.data.logisticsStatus,
      reason: this.data.reason,
      number: this.data.number,
      amount,
      remark: this.data.remark || '',
      pic: this.data.pics.join()
    })
    
    wx.hideLoading()

    if (res.code == 20000) {
      wx.showModal({
        content: this.data.$t.refund.applyingTip,
        showCancel: false
      })
      return
    }

    if (res.code == 0) {
      wx.showModal({
        content: this.data.$t.refund.submitSuccess,
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    } else {
      wx.showModal({
        content: res.msg || this.data.$t.refund.submitFail,
        showCancel: false
      })
    }
  },

  // 查看售后详情
  refundDetail(e) {
    const index = e.currentTarget.dataset.idx
    const curRufund = this.data.refundApplyList[index]
    const imageList = []
    if (curRufund.pics) {
      curRufund.pics.forEach(ele => {
        imageList.push(ele.pic + '_m')
      })
    }
    let logisticsContent = curRufund.baseInfo.logisticsContent
    if (logisticsContent) {
      logisticsContent = JSON.parse(logisticsContent)
    }
    this.setData({
      popShow: true,
      curRufund,
      imageList,
      logisticsContent
    })
  },

  popClose() {
    this.setData({
      popShow: false
    })
  },

  // 预览图片
  previewImageimageList(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.current,
      urls: this.data.imageList
    })
  },

  // 撤回申请
  async refundApplyCancel() {
    wx.showLoading({ title: '' })
    const res = await WXAPI.refundApplyCancel(
      wx.getStorageSync('token'),
      this.data.curRufund.baseInfo.orderId,
      this.data.curRufund.baseInfo.orderGoodsId
    )
    wx.hideLoading()

    if (res.code == 0) {
      wx.showToast({
        title: this.data.$t.refund.cancelSuccess
      })
      this.popClose()
      this.orderDetail()
    } else {
      wx.showToast({
        title: res.msg,
        icon: 'none'
      })
    }
  },

  // 显示快递信息输入弹窗
  showLogisticsDialog() {
    this.setData({
      logisticsDialogShow: true,
      shipperName: '',
      trackingNumber: ''
    })
  },

  closeLogisticsDialog() {
    this.setData({
      logisticsDialogShow: false
    })
  },

  // 提交快递信息
  async submitLogistics() {
    const { shipperName, trackingNumber } = this.data

    if (!shipperName || !shipperName.trim()) {
      wx.showToast({
        title: this.data.$t.refund.logisticsCompanyPlaceholder,
        icon: 'none'
      })
      return
    }

    if (!trackingNumber || !trackingNumber.trim()) {
      wx.showToast({
        title: this.data.$t.refund.logisticsNumberPlaceholder,
        icon: 'none'
      })
      return
    }

    wx.showLoading({ title: '' })
    const res = await WXAPI.refundApplySetBackLogistics({
      token: wx.getStorageSync('token'),
      orderId: this.data.curRufund.baseInfo.orderId,
      applyId: this.data.curRufund.baseInfo.id,
      shipperName: shipperName.trim(),
      trackingNumber: trackingNumber.trim()
    })

    wx.hideLoading()

    if (res.code == 0) {
      wx.showToast({
        title: this.data.$t.refund.submitSuccess,
        icon: 'success'
      })
      this.closeLogisticsDialog()
      this.orderDetail()
      this.popClose()
    } else {
      wx.showToast({
        title: res.msg || this.data.$t.refund.submitFail,
        icon: 'none'
      })
    }
  },

  // 联系客服
  customerService() {
    if (CONFIG.customerServiceType == 'QW') {
      wx.openCustomerServiceChat({
        extInfo: { url: wx.getStorageSync('customerServiceChatUrl') },
        corpId: wx.getStorageSync('customerServiceChatCorpId'),
        success: () => {},
        fail: err => {
          console.error(err)
        }
      })
    }
  }
})
