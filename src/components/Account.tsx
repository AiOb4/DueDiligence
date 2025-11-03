import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { app } from "./firebaseConfig";
import { getUserProfile, updateUserProfile } from "./firebaseAuth";

export default function Account() {
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    fullName: "",
    email: "",
    role: "",
    company: "",
    phone: "",
    location: "",
  });
  const [editData, setEditData] = useState(userData);
  const auth = getAuth(app);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      // Fetch Firestore profile data
      getUserProfile(user.uid).then((profileData) => {
        if (profileData) {
          setUserData({
            fullName: profileData.fullName || user.displayName || "",
            email: profileData.email || user.email || "",
            role: profileData.role || "",
            company: profileData.company || "",
            phone: profileData.phone || "",
            location: profileData.location || "",
          });
        } else {
          // fallback to basic info
          setUserData({
            fullName: user.displayName || "",
            email: user.email || "",
            role: "",
            company: "",
            phone: "",
            location: "",
          });
        }
      });
    }
  }, [auth.currentUser]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditData(userData);
  };

  const handleSave = async () => {
    setUserData(editData);
    setIsEditing(false);
    const user = auth.currentUser;
    if (user) {
      await updateUserProfile(user.uid, editData);
      alert("Profile updated successfully!");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData(userData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditData({
      ...editData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="account-container">
      <div className="account-header">
        <h2>Account Settings</h2>
        <p>Manage your profile and account preferences</p>
      </div>

      <div className="account-content">
        <div className="account-sidebar">
          <div className="account-avatar">
            <div className="avatar-circle">
              {userData.fullName
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <button className="button button-secondary">Change Photo</button>
          </div>

          <div className="account-stats">
            <div className="account-stat-item">
              <span className="stat-label">Member Since</span>
              <span className="stat-value">Jan 2024</span>
            </div>
            <div className="account-stat-item">
              <span className="stat-label">Projects Analyzed</span>
              <span className="stat-value">24</span>
            </div>
            <div className="account-stat-item">
              <span className="stat-label">Reports Generated</span>
              <span className="stat-value">18</span>
            </div>
          </div>
        </div>

        <div className="account-main">
          <div className="account-section">
            <div className="section-header">
              <h3>Personal Information</h3>
              {!isEditing ? (
                <button onClick={handleEdit} className="button button-secondary">
                  Edit Profile
                </button>
              ) : (
                <div className="edit-actions">
                  <button onClick={handleCancel} className="button button-secondary">
                    Cancel
                  </button>
                  <button onClick={handleSave} className="button button-primary">
                    Save Changes
                  </button>
                </div>
              )}
            </div>

            <div className="account-fields">
              <div className="field-group">
                <label>Full Name</label>
                {isEditing ? (
                  <input type="text" name="fullName" value={editData.fullName} onChange={handleChange} />
                ) : (
                  <p>{userData.fullName}</p>
                )}
              </div>

              <div className="field-group">
                <label>Email Address</label>
                {isEditing ? (
                  <input type="email" name="email" value={editData.email} onChange={handleChange} />
                ) : (
                  <p>{userData.email}</p>
                )}
              </div>

              <div className="field-group">
                <label>Role</label>
                {isEditing ? (
                  <input type="text" name="role" value={editData.role} onChange={handleChange} />
                ) : (
                  <p>{userData.role}</p>
                )}
              </div>

              <div className="field-group">
                <label>Company</label>
                {isEditing ? (
                  <input type="text" name="company" value={editData.company} onChange={handleChange} />
                ) : (
                  <p>{userData.company}</p>
                )}
              </div>

              <div className="field-group">
                <label>Phone</label>
                {isEditing ? (
                  <input type="tel" name="phone" value={editData.phone} onChange={handleChange} />
                ) : (
                  <p>{userData.phone}</p>
                )}
              </div>

              <div className="field-group">
                <label>Location</label>
                {isEditing ? (
                  <input type="text" name="location" value={editData.location} onChange={handleChange} />
                ) : (
                  <p>{userData.location}</p>
                )}
              </div>
            </div>
          </div>

          <div className="account-section">
            <h3>Security</h3>
            <div className="account-fields">
              <div className="field-group">
                <label>Password</label>
                <p>••••••••</p>
                <button className="button button-secondary">Change Password</button>
              </div>

              <div className="field-group">
                <label>Two-Factor Authentication</label>
                <p>Not enabled</p>
                <button className="button button-secondary">Enable 2FA</button>
              </div>
            </div>
          </div>

          <div className="account-section">
            <h3>Preferences</h3>
            <div className="account-fields">
              <div className="field-group">
                <label className="checkbox-label">
                  <input type="checkbox" defaultChecked />
                  <span>Email notifications for completed analyses</span>
                </label>
              </div>

              <div className="field-group">
                <label className="checkbox-label">
                  <input type="checkbox" defaultChecked />
                  <span>Weekly summary reports</span>
                </label>
              </div>

              <div className="field-group">
                <label className="checkbox-label">
                  <input type="checkbox" />
                  <span>Marketing communications</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
