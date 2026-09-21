const Project = require('../models/Project');
const { isValidObjectId } = require('../utils/validate');

// GET /api/projects - public
exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({}).sort({ createdAt: -1 });
    res.json({ success: true, projects });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get projects' });
  }
};

// POST /api/projects - superadmin
exports.createProject = async (req, res) => {
  try {
    const { name, location, sqft, descriptionEn, descriptionTa, photos, completed } = req.body;
    if (!name || !location) {
      return res.status(400).json({ success: false, message: 'Name and location required' });
    }
    const project = await Project.create({ name, location, sqft, descriptionEn, descriptionTa, photos: photos || [], completed });
    res.status(201).json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create project' });
  }
};

// PUT /api/projects/:id - superadmin
exports.updateProject = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID' });
    }
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update project' });
  }
};

// DELETE /api/projects/:id - superadmin
exports.deleteProject = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID' });
    }
    await Project.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete project' });
  }
};
