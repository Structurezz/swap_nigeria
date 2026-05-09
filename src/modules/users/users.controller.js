const { getProfile, updateProfile, updateAvatar, getPublicProfile } = require('./users.service');
const { uploadSingle, uploadToGridFS, fileUrl } = require('../../utils/upload');

const getMeController = async (req, res, next) => {
  try {
    const user = await getProfile(req.user.id);
    res.json({ data: user });
  } catch (err) { next(err); }
};

const updateMeController = async (req, res, next) => {
  try {
    const user = await updateProfile(req.user.id, req.body);
    res.json({ data: user });
  } catch (err) { next(err); }
};

const uploadAvatarController = [
  uploadSingle('avatar'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
      }
      const fileId = await uploadToGridFS(req.file.buffer, req.file.originalname, req.file.mimetype);
      const user = await updateAvatar(req.user.id, fileUrl(fileId));
      res.json({ data: user });
    } catch (err) { next(err); }
  },
];

const getPublicProfileController = async (req, res, next) => {
  try {
    const result = await getPublicProfile(req.params.userId);
    res.json({ data: result });
  } catch (err) { next(err); }
};

module.exports = { getMeController, updateMeController, uploadAvatarController, getPublicProfileController };
