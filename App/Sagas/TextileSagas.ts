/* ***********************************************************
* A short word on how to use this automagically generated file.
* We're often asked in the ignite gitter channel how to connect
* to a to a third party api, so we thought we'd demonstrate - but
* you should know you can use sagas for other flow control too.
*
* Other points:
*  - You'll need to add this saga to sagas/index.js
*  - This template uses the api declared in sagas/index.js, so
*    you'll need to define a constant in that file.
*************************************************************/
import { AppState, Share, PermissionsAndroid, Platform } from 'react-native'
import { delay } from 'redux-saga'
import { call, put, select, take, fork } from 'redux-saga/effects'
import RNFS from 'react-native-fs'
import Config from 'react-native-config'
import {
  prepareFiles,
  addThreadFiles,
  overview,
  Overview,
  contacts,
  ContactInfo,
  checkCafeMessages,
  addThreadIgnore,
  setAvatar,
  peerId,
  profile,
  Profile,
  addThreadLike,
  BlockInfo
} from '../NativeModules/Textile'
import NavigationService from '../Services/NavigationService'
import { getPhotos } from '../Services/CameraRoll'
import * as NotificationsSagas from './NotificationsSagas'
import StartupActions from '../Redux/StartupRedux'
import UploadingImagesActions, { UploadingImagesSelectors, UploadingImage } from '../Redux/UploadingImagesRedux'
import TextileNodeActions, { TextileNodeSelectors } from '../Redux/TextileNodeRedux'
import PreferencesActions, { PreferencesSelectors } from '../Redux/PreferencesRedux'
import AccountActions from '../Redux/AccountRedux'
import ContactsActions from '../Redux/ContactsRedux'
import UIActions, { UISelectors } from '../Redux/UIRedux'
import { defaultThreadData } from '../Redux/PhotoViewingSelectors'
import { ActionType, getType } from 'typesafe-actions'
import * as CameraRoll from '../Services/CameraRoll'
// @ts-ignore
import Upload from 'react-native-background-upload'
import { ThreadData } from '../Redux/PhotoViewingRedux'
import {logNewEvent} from './DeviceLogs'
import PhotoViewingActions from '../Redux/PhotoViewingRedux'
import PhotoViewingAction from '../Redux/PhotoViewingRedux'
import StorageActions from '../Redux/StorageRedux'
import { IMobilePreparedFiles } from '../NativeModules/Textile/pb/textile-go'
import { RootState } from '../Redux/Types'
import { SharedImage } from '../Models/TextileTypes'

export function * updateNodeOverview ( action: ActionType<typeof TextileNodeActions.updateOverviewRequest> ) {
  try {
    yield call(NotificationsSagas.waitUntilOnline, 2500)
    const overviewResult: Overview = yield call(overview)
    yield put(StorageActions.storeOverview(overviewResult))
  } catch (error) {
    // do nothing
  }
}

export function * handleProfilePhotoSelected(action: ActionType<typeof UIActions.selectProfilePicture>) {
  yield * processAvatarImage(action.payload.image)
}

export function * handleProfilePhotoUpdated(action: ActionType<typeof UIActions.updateProfilePicture>) {
  yield * processAvatarImage(action.payload.image)
}

function * processAvatarImage(image: SharedImage) {
  try {
    const defaultThread: ThreadData | undefined = yield select(defaultThreadData)
    if (!defaultThread) {
      throw new Error('no default thread')
    }
    yield put(UIActions.sharePhotoRequest(image, defaultThread.id))
  } catch (error) {
    // TODO: What do to if adding profile photo fails?
  }
}

export function * navigateToThread ( action: ActionType<typeof UIActions.navigateToThreadRequest> ) {
  yield put(PhotoViewingActions.viewThread(action.payload.threadId))
  yield call(NavigationService.navigate, 'ViewThread', { threadId: action.payload.threadId })
}

export function * navigateToComments ( action: ActionType<typeof UIActions.navigateToCommentsRequest> ) {
  const { photoId, threadId } = action.payload
  if (threadId) {
    // Required to navigate to a thread photo's comments from the all threads screen
    yield put(PhotoViewingAction.viewThread(threadId))
  }
  yield put(PhotoViewingActions.viewPhoto(photoId))
  yield call(NavigationService.navigate, 'Comments')
}

export function * navigateToLikes ( action: ActionType<typeof UIActions.navigateToLikesRequest> ) {
  const { photoId, threadId } = action.payload
  if (threadId) {
    // Required to navigate to a thread photo's likes from the all threads screen
    yield put(PhotoViewingAction.viewThread(threadId))
  }
  yield put(PhotoViewingActions.viewPhoto(photoId))
  yield call(NavigationService.navigate, 'LikesScreen')
}

export function * refreshContacts () {
  try {
    const contactsResult: ReadonlyArray<ContactInfo> = yield call(contacts)
    yield put(ContactsActions.getContactsSuccess(contactsResult))
  } catch (error) {
    // skip for now
  }
}

export function * addFriends ( action: ActionType<typeof UIActions.addFriendRequest> ) {
  yield call(refreshContacts)
}

export function * initializeAppState () {
    yield take(getType(StartupActions.startup))
    const defaultAppState = yield select(TextileNodeSelectors.appState)
    let queriedAppState = defaultAppState
    while (queriedAppState.match(/default|unknown/)) {
      yield delay(10)
      const currentAppState = yield call(() => AppState.currentState)
      queriedAppState = currentAppState || 'unknown'
    }
    yield put(TextileNodeActions.appStateChange(defaultAppState, queriedAppState))
}

export function * refreshMessages () {
  while (yield take(getType(TextileNodeActions.refreshMessagesRequest))) {
    try {
      yield call(checkCafeMessages)
      yield put(TextileNodeActions.refreshMessagesSuccess(Date.now()))
      yield call(logNewEvent, 'Refresh messages', 'Checked offline messages')
    } catch (error) {
      yield call(logNewEvent, 'Refresh messages', error.message, true)
      yield put(TextileNodeActions.refreshMessagesFailure(error))
    }
  }
}

export function * ignorePhoto (action: ActionType<typeof TextileNodeActions.ignorePhotoRequest>) {
  const { blockId } = action.payload
  try {
    yield call(NavigationService.goBack)
    yield call(addThreadIgnore, blockId)
  } catch (error) {
    // do nothing new for now
  }
}

export function * nodeOnlineSaga () {
  const online = yield select(TextileNodeSelectors.online)
  if (online) {
    try {
      const pending: string | undefined = yield select((state: RootState) => state.account.avatar.pendingId)
      if (pending) {
        yield call(setAvatar, pending)
      }
    } catch (error) {
      // nada
    }
  }
}

export function * synchronizeNativeUploads() {
  try {
    // THIS COULD potentiall lead to some edge cases where we receive two Error messages
    // back to back... one from here and one later from the Native layer. We should check
    // what is up if that occurs.
    // Grab all the upload Ids from the native layer
    const nativeUploads = yield call(Upload.activeUploads)
    // Grab all the upload Ids from the react native layer
    const reactUploads: string[] = yield select(UploadingImagesSelectors.uploadingImageIds)
    // Check that each upload ID from the react layer exists in the array from the native layer
    // If not, register an image upload error so a retry can happen if necessary
    for (const uploadId of reactUploads) {
      if (!nativeUploads.includes(uploadId)) {
        // Register the error with a normal image action upload error
        yield put(UploadingImagesActions.imageUploadError(uploadId, 'Upload not found in native upload queue.'))
      }
    }
  } catch (error) {
    yield put(UploadingImagesActions.synchronizeNativeUploadsError(error))
  }
}

export function * chooseProfilePhoto () {
  try {
    const result: { image: CameraRoll.IPickerImage, data: string } = yield call(CameraRoll.chooseProfilePhoto)
    const image: SharedImage = {
      isAvatar: true,
      origURL: result.image.origURL,
      uri: result.image.uri,
      path: result.image.path,
      canDelete: result.image.canDelete
    }
    yield put(UIActions.chooseProfilePhotoSuccess(image, result.data))
  } catch (error) {
    yield put(UIActions.chooseProfilePhotoError(error))
  }
}

export function * removePayloadFile (action: ActionType<typeof UploadingImagesActions.imageUploadComplete>) {
  // TODO: Seeing an error here where the file is sometimes not found on disk...
  const { dataId } = action.payload
  const uploadingImage: UploadingImage = yield select(UploadingImagesSelectors.uploadingImageById, dataId)
  try {
    // Putting this into a try, because although it might be nice to have the
    // error bubble up, we want to be sure we mark the image as uploaded
    yield call(RNFS.unlink, uploadingImage.path)
  } finally {
    yield put(UploadingImagesActions.imageRemovalComplete(dataId))
  }
}

export function * handleUploadError (action: ActionType<typeof UploadingImagesActions.imageUploadError>) {
  const { dataId } = action.payload
  const uploadingImage: UploadingImage = yield select(UploadingImagesSelectors.uploadingImageById, dataId)
  // If there are no more upload attempts, delete the payload file to free up disk space
  if (uploadingImage.remainingUploadAttempts === 0) {
    try {
      yield call(RNFS.unlink, uploadingImage.path)
    } catch (error) { }
    // Commenting this out for now so we can always see the last error that happend,
    // even though we're not going to retry the upload again.
    // yield put(UploadingImagesActions.imageRemovalComplete(dataId))
  }
}

export function * presentPublicLinkInterface(action: ActionType<typeof UIActions.shareByLink>) {
  const { path } = action.payload
  try {
    const link = Config.RN_TEXTILE_CAFE_GATEWAY_URL + '/ipfs/' + path
    yield call(Share.share, {title: '', message: link})
  } catch (error) {}
}

export function * updateServices (action: ActionType<typeof PreferencesActions.toggleServicesRequest>) {
  const {name} = action.payload
  let currentStatus = action.payload.status
  if (!currentStatus) {
    const service = yield select(PreferencesSelectors.service, name)
    currentStatus = !service ? false : service.status
  }
  if (name === 'backgroundLocation' && currentStatus === true) {
    yield * backgroundLocationPermissionsTrigger()
  } else if (name === 'notifications' && currentStatus === true) {
    yield call(NotificationsSagas.enable)
  }
}

export function * cameraPermissionsTrigger () {
  // Will trigger a camera permission request
  if (Platform.OS === 'android') {
    const permission = yield call(PermissionsAndroid.request, PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE, {
        title: 'Textile Photos Photos Permission',
        message: 'Textile accesses your photo storage to import any new photos you take after you install the app.'
      })
  } else {
    getPhotos(1)
  }
}

export function * backgroundLocationPermissionsTrigger () {
  if (Platform.OS === 'android') {
    yield call(PermissionsAndroid.request, PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Location Please',
      message: 'Background location allows Textile to wake up periodically to check for updates to your camera roll and to check for updates on your peer-to-peer network.'
    })
  } else {
    yield call(navigator.geolocation.requestAuthorization)
  }
}

export function * addPhotoLike (action: ActionType<typeof UIActions.addLikeRequest>) {
  const { blockId } = action.payload
  try {
    yield call(addThreadLike, blockId)
  } catch (error) {

  }
}
