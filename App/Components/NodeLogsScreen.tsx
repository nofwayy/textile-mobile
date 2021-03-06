import React, { Component } from 'react'
import { ScrollView, TextInput, Platform, Clipboard } from 'react-native'
import FS, { exists } from 'react-native-fs'
import { NavigationScreenProps} from 'react-navigation'
import * as s from '../Themes/Constants'
import { REPO_PATH } from '../Sagas/NodeLifecycle'
import { TextileHeaderButtons, Item as TextileItem } from './HeaderButtons'

const LOG_FILE_PATH = `${REPO_PATH}/logs/textile.log`

interface NavProps {
  refresh: () => void
  copy: () => void
}

interface State {
  logData?: string
}

export default class NodeLogsScreen  extends Component<NavigationScreenProps<NavProps>, State> {

  static navigationOptions = ({ navigation }: NavigationScreenProps<NavProps>) => {
    const refresh = navigation.getParam('refresh')
    const copy = navigation.getParam('copy')
    const goBack = () => navigation.goBack()
    return {
      headerTitle: 'Node Logs',
      headerLeft: (
        <TextileHeaderButtons left={true}>
          <TextileItem title='Back' iconName='arrow-left' onPress={goBack} />
        </TextileHeaderButtons>
      ),
      headerRight: ((
        <TextileHeaderButtons>
          <TextileItem title='Copy' iconName='clipboard-plus' onPress={copy} />
          <TextileItem title='Refresh' iconName='refresh-ccw' onPress={refresh} />
        </TextileHeaderButtons>
      ))
    }
  }

  state: State = {}

  textInput?: TextInput
  scrollView?: ScrollView

  refreshLogData = async () => {
    const extists = await FS.exists(LOG_FILE_PATH)
    if (exists) {
      const stats = await FS.stat(LOG_FILE_PATH)
      const size = stats.size as unknown as number
      const bytesToRead = 1024 * 300
      const offset = size - bytesToRead
      const contents = await FS.read(LOG_FILE_PATH, bytesToRead, offset, 'utf8')
      this.setState({ logData: contents })
    }
  }

  copyLogData = () => {
    if (this.state.logData) {
      Clipboard.setString(this.state.logData)
    }
  }

  scrollToBottom = () => {
    if (this.scrollView) {
      this.scrollView!.scrollToEnd({animated: true})
    }
  }

  componentWillMount() {
    this.props.navigation.setParams({
      refresh: this.refreshLogData,
      copy: this.copyLogData
    })
    this.refreshLogData()
  }

  render() {
    const font = Platform.OS === 'ios' ? 'Courier' : 'monospace'
    return (
      <ScrollView
        ref={(ref) => { this.scrollView = ref ? ref : undefined }}
        style={{ flex: 1, backgroundColor: s.COLOR_BACKGROUND_PRIMARY }}
      >
        <TextInput
          ref={(ref) => { this.textInput = ref ? ref : undefined }}
          style={{ flex: 1, fontFamily: font, fontSize: s.FONT_SIZE_SMALL, paddingHorizontal: s.MARGIN_EXTRA_SMALL, backgroundColor: s.COLOR_BACKGROUND_PRIMARY }}
          editable={false}
          value={this.state.logData}
          multiline={true}
          onContentSizeChange={this.scrollToBottom}
        />
      </ScrollView>
    )
  }
}
