import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import Avatar from '../../../Components/Avatar'
import Icons from '../../../Components/Icon'
import ImageSc from 'react-native-scalable-image'

import RadioButton from '../../components/RadioButton'

import styles from './statics/styles'

const ContactSelectCard = (props) => {
  const { item, select, selected } = props

  return (
    <TouchableOpacity activeOpacity={0.6} style={styles.contactItem} onPress={() => {
      select(item, item.included)
    }}>
      <Avatar style={styles.selectedContact} peerId={item.id} />
      <Text style={styles.contactName}>{item.username || 'peer'}</Text>
      <View style={styles.contactSelectRadio}>
        <RadioButton disabled={item.included} selected={selected} />
      </View>
    </TouchableOpacity>
  )
}

export const ContactLinkCard = (props) => {
  const { text, icon, select } = props
  return (
    <TouchableOpacity activeOpacity={0.6} style={styles.contactItem} onPress={() => {
      select()
    }}>
      {icon === 'qr-code' && <ImageSc
        source={require('../../../Images/v2/qr.png')}
        width={20}
        height={20}
        resizeMode={'cover'}
        style={styles.linkIcon}
      />}
      {icon !== 'qr-code' && <Icons name={icon} size={20} color={'#2E8BFE'} style={styles.linkIcon}/>}
      <Text style={styles.linkText}>{text}</Text>
    </TouchableOpacity>
  )
}

export default ContactSelectCard
