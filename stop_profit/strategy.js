var z = require('zero-fill')
  , n = require('numbro')
  , rsi = require('../../../lib/rsi')
  , Phenotypes = require('../../../lib/phenotype')

module.exports = {
  name: 'stop_profit_rsi',
  description: 'Proof of concept implemetation of a stop profit with trailing stop',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '5m')
    this.option('period_length', 'period length, same as --period', String, '5m')
    this.option('min_periods', 'min. number of history periods', Number, 100)
    this.option('rsi_periods', 'number of RSI periods', Number, 14)
    this.option('rsi_oversold', 'oversold RSI value', Number, 30)
    this.option('stop_loss', 'negative decimal', Number, -0.05)
    this.option('profit_stop_enable', 'decimal', Number, 0.03)
    this.option('profit_stop_trail', 'decimal', Number, 0.005)

  },

  calculate: function (s) {

    if (typeof s.high_watermark === 'undefined') {
      s.high_watermark = 0 
    }

    if (!s.in_preroll){
    rsi(s, 'rsi', s.options.rsi_periods)
    }
  },

  onPeriod: function (s, cb) {

      //Calculate profit/loss (decimal)
      if (s.my_trades.length || s.my_prev_trades.length) {
        var last_trade
        if (s.my_trades.length) {
          last_trade = s.my_trades[s.my_trades.length - 1]
        } else {
          last_trade = s.my_prev_trades[s.my_prev_trades.length - 1]
        }
        s.last_trade_worth = last_trade.type === 'buy' ? (s.period.close - last_trade.price) / last_trade.price : (last_trade.price - s.period.close) / last_trade.price
      }

      //Profit stop reached? Set high watermark
      if(s.last_trade_worth > s.options.profit_stop_enable && s.high_watermark == 0 && last_trade.type === 'buy'){
        s.high_watermark = s.last_trade_worth
        }
      //Has a new high watermark been reached?
      if(s.last_trade_worth > s.high_watermark && s.high_watermark > 0 && last_trade.type === 'buy'){
        s.high_watermark = s.last_trade_worth
      }

      // BUY && SELL
      s.signal = null
      
      //Trailing stop triggered below the high watermark?
      if (s.last_trade_worth < s.high_watermark - s.options.profit_stop_trail
        && s.high_watermark != 0) {
        s.signal = 'sell'
        s.high_watermark = 0  
      }
      //A stop loss also works quite well within a strategy
      if (s.last_trade_worth <= s.options.stop_loss) {
        s.signal = 'sell'
        s.high_watermark = 0  
      }
      //A buy signal must also come from somewhere. We pick a RSI here
      if(s.period.rsi > s.options.rsi_oversold
        && s.lookback[0].rsi < s.options.rsi_oversold
        && s.high_watermark == 0){
        s.signal='buy'
     }   
      

    cb()
  },

  onReport: function (s) {
    var cols = []
    var color = 'grey'
    cols.push(z(10, n(s.last_trade_worth).format('-0.00000'), ' ')[color])
    cols.push(z(10, n(s.high_watermark).format('0.0000000'), ' ')[color])
    return cols
  },

phenotypes: {

    // -- common 
	  period_length: Phenotypes.ListOption(['20s','30s','40s','60s','90s', '3m', '5m', '10m', '15m', '30m', '1h']),
	  min_periods: Phenotypes.Range(100, 100),

    rsi_periods: Phenotypes.Range(10, 20),
    rsi_oversold: Phenotypes.RangeFactor(15, 35, 5),

    stop_loss: Phenotypes.RangeFactor(-0.01, -0.1, 0.005),
    profit_stop_enable: Phenotypes.RangeFactor(0.01, 0.1, 0.001),
    profit_stop_trail: Phenotypes.RangeFactor(0.003, 0.03, 0.001),
   
  }
}
